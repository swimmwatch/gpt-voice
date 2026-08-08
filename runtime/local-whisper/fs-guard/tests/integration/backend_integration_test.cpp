#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/guard_application.hpp"
#include "local_whisper/fs_guard/protocol.hpp"

#if defined(_WIN32)
#include "platform/windows/windows_backend.hpp"

#include <windows.h>
#include <winioctl.h>
#else
#include "platform/linux/linux_backend.hpp"

#include <unistd.h>
#endif

#include <gtest/gtest.h>

#include <chrono>
#include <cstddef>
#include <cstring>
#include <filesystem>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

const std::string kArtifactName = "model-" + std::string(64, 'a');
const std::string kNonce = "1234567890abcdef";

std::unique_ptr<Backend> make_backend() {
#if defined(_WIN32)
  return std::make_unique<WindowsBackend>();
#else
  return std::make_unique<LinuxBackend>();
#endif
}

std::unique_ptr<Backend> make_backend(ResourceFailureInjector& failure_injector) {
#if defined(_WIN32)
  return std::make_unique<WindowsBackend>(failure_injector);
#else
  return std::make_unique<LinuxBackend>(failure_injector);
#endif
}

std::string platform_name() {
#if defined(_WIN32)
  return "win32";
#else
  return "linux";
#endif
}

std::string process_id() {
#if defined(_WIN32)
  return std::to_string(GetCurrentProcessId());
#else
  return std::to_string(getpid());
#endif
}

std::size_t process_resource_count() {
#if defined(_WIN32)
  DWORD count = 0;
  if (GetProcessHandleCount(GetCurrentProcess(), &count) == FALSE) {
    throw std::runtime_error("process handle count unavailable");
  }
  return count;
#else
  std::size_t count = 0;
  for (const auto& entry : std::filesystem::directory_iterator("/proc/self/fd")) {
    static_cast<void>(entry);
    ++count;
  }
  return count;
#endif
}

std::string artifact_name_with_marker(const std::size_t marker) {
  std::string result = kArtifactName;
  result.at(std::string("model-").size() + marker) = 'b';
  return result;
}

class TemporaryManagedRoot final {
public:
  TemporaryManagedRoot() {
    const auto suffix = std::chrono::steady_clock::now().time_since_epoch().count();
    cleanup_path_ = std::filesystem::temp_directory_path() /
                    ("gpt-voice-fs-guard-native-test-" + std::to_string(suffix));
    path_ = cleanup_path_ / "local-whisper";
    if (!cleanup_path_.filename().string().starts_with("gpt-voice-fs-guard-native-test-")) {
      throw std::runtime_error("unsafe temporary test root");
    }
  }

  ~TemporaryManagedRoot() noexcept {
    std::error_code error;
    std::filesystem::remove_all(cleanup_path_, error);
  }

  TemporaryManagedRoot(const TemporaryManagedRoot&) = delete;
  TemporaryManagedRoot& operator=(const TemporaryManagedRoot&) = delete;

  [[nodiscard]] const std::filesystem::path& path() const noexcept { return path_; }

private:
  std::filesystem::path cleanup_path_;
  std::filesystem::path path_;
};

class FailAtResourceAcquisition final : public ResourceFailureInjector {
public:
  explicit FailAtResourceAcquisition(const std::size_t failure_ordinal) noexcept
      : failure_ordinal_(failure_ordinal) {}

  void before_resource_acquisition() override {
    ++acquisition_count_;
    if (acquisition_count_ == failure_ordinal_)
      throw GuardError("IO_FAILED");
  }

  [[nodiscard]] std::size_t acquisition_count() const noexcept { return acquisition_count_; }

private:
  std::size_t failure_ordinal_;
  std::size_t acquisition_count_ = 0;
};

void complete_managed_artifact_lifecycle(Backend& backend, const std::filesystem::path& root_path) {
  const auto root = backend.initialize({platform_name(), root_path.string()});
  const auto identity = backend.process_identity({process_id()});
  const LockCommand lock_command{root[0],     kArtifactName, kNonce,       process_id(),
                                 identity[0], "staging",     kArtifactName};
  const auto lock = backend.lock(lock_command);
  EXPECT_TRUE(backend.release({lock[0]}).empty());

  const auto staging = backend.create_staging({root[0], "model", kArtifactName, kNonce});
  const auto file = backend.create_file({staging[0], "file-model", "384"});
  EXPECT_TRUE(backend.write_file({file[0], "failure-injection"}).empty());
  const auto sealed = backend.seal_file({file[0]});
  EXPECT_TRUE(backend.release({file[0]}).empty());
  EXPECT_FALSE(backend.list({staging[0], {"file-model|384"}}).empty());

  EXPECT_TRUE(backend.promote({root[0], staging[0], "models", kArtifactName}).size() == 1U);
  EXPECT_TRUE(backend.release({staging[0]}).empty());
  const auto opened = backend.open_artifact({root[0], "models", kArtifactName});
  const auto quarantined =
      backend.quarantine({root[0], opened[0], "models", kArtifactName, kNonce});
  EXPECT_TRUE(backend.release({opened[0]}).empty());
  EXPECT_TRUE(backend.delete_file({quarantined[0], "file-model", sealed[0]}).empty());
  EXPECT_TRUE(backend.remove_quarantine({root[0], quarantined[0]}).empty());
  EXPECT_TRUE(backend.release({quarantined[0]}).empty());
  EXPECT_TRUE(backend.release({root[0]}).empty());
}

#if defined(_WIN32)
struct MountPointReparseData final {
  DWORD tag;
  WORD data_length;
  WORD reserved;
  WORD substitute_offset;
  WORD substitute_length;
  WORD print_offset;
  WORD print_length;
  wchar_t path_buffer[1];
};

void create_junction(const std::filesystem::path& link, const std::filesystem::path& target) {
  std::filesystem::create_directories(link);
  std::filesystem::create_directories(target);
  const std::wstring print_name = std::filesystem::absolute(target).native();
  const std::wstring substitute_name = L"\\??\\" + print_name;
  const std::size_t path_bytes =
      (substitute_name.size() + 1 + print_name.size() + 1) * sizeof(wchar_t);
  const std::size_t total_bytes = offsetof(MountPointReparseData, path_buffer) + path_bytes;
  std::vector<unsigned char> storage(total_bytes);
  auto* data = reinterpret_cast<MountPointReparseData*>(storage.data());
  data->tag = IO_REPARSE_TAG_MOUNT_POINT;
  data->data_length = static_cast<WORD>(total_bytes - 8);
  data->reserved = 0;
  data->substitute_offset = 0;
  data->substitute_length = static_cast<WORD>(substitute_name.size() * sizeof(wchar_t));
  data->print_offset = static_cast<WORD>((substitute_name.size() + 1) * sizeof(wchar_t));
  data->print_length = static_cast<WORD>(print_name.size() * sizeof(wchar_t));
  std::memcpy(data->path_buffer, substitute_name.c_str(),
              (substitute_name.size() + 1) * sizeof(wchar_t));
  std::memcpy(reinterpret_cast<unsigned char*>(data->path_buffer) + data->print_offset,
              print_name.c_str(), (print_name.size() + 1) * sizeof(wchar_t));

  const HANDLE handle =
      CreateFileW(link.c_str(), GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
                  FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (handle == INVALID_HANDLE_VALUE) {
    throw std::runtime_error("junction handle unavailable");
  }
  DWORD returned = 0;
  const BOOL result =
      DeviceIoControl(handle, FSCTL_SET_REPARSE_POINT, data, static_cast<DWORD>(total_bytes),
                      nullptr, 0, &returned, nullptr);
  CloseHandle(handle);
  if (result == FALSE) {
    throw std::runtime_error("junction creation failed");
  }
}
#endif

TEST(RealBackendIntegrationTest, CompletesTheManagedArtifactLifecycle) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});
  ASSERT_EQ(root.size(), 2U);

  const auto staging = backend->create_staging({root[0], "model", kArtifactName, kNonce});
  ASSERT_EQ(staging.size(), 2U);
  const auto file = backend->create_file({staging[0], "file-model", "384"});
  ASSERT_EQ(file.size(), 2U);
  EXPECT_TRUE(backend->write_file({file[0], "hello"}).empty());
  const auto sealed = backend->seal_file({file[0]});
  ASSERT_EQ(sealed.size(), 1U);
  EXPECT_TRUE(backend->release({file[0]}).empty());
  EXPECT_FALSE(backend->list({staging[0], {"file-model|384"}}).empty());
  EXPECT_TRUE(backend->revalidate({staging[0], staging[1]}).empty());

  ASSERT_EQ(backend->promote({root[0], staging[0], "models", kArtifactName}).size(), 1U);
  EXPECT_TRUE(backend->release({staging[0]}).empty());
  const auto opened = backend->open_artifact({root[0], "models", kArtifactName});
  ASSERT_EQ(opened.size(), 2U);
  EXPECT_TRUE(backend->revalidate({opened[0], opened[1]}).empty());

  const auto quarantined =
      backend->quarantine({root[0], opened[0], "models", kArtifactName, kNonce});
  ASSERT_EQ(quarantined.size(), 2U);
  EXPECT_TRUE(backend->release({opened[0]}).empty());
  EXPECT_TRUE(backend->delete_file({quarantined[0], "file-model", sealed[0]}).empty());
  EXPECT_TRUE(backend->remove_quarantine({root[0], quarantined[0]}).empty());

  for (const auto& token : {file[0], staging[0], opened[0], quarantined[0], root[0]}) {
    EXPECT_TRUE(backend->release({token}).empty());
  }
}

TEST(RealBackendIntegrationTest, EnforcesLockConflictAndRelease) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});
  const auto identity = backend->process_identity({process_id()});
  ASSERT_EQ(identity.size(), 1U);

  const LockCommand lock_command{root[0],     kArtifactName, kNonce,       process_id(),
                                 identity[0], "staging",     kArtifactName};
  const auto first = backend->lock(lock_command);
  ASSERT_EQ(first.size(), 2U);
  EXPECT_THROW(static_cast<void>(backend->lock(lock_command)), GuardError);
  EXPECT_TRUE(backend->release({first[0]}).empty());
  const auto second = backend->lock(lock_command);
  ASSERT_EQ(second.size(), 2U);
  EXPECT_TRUE(backend->release({second[0]}).empty());
  EXPECT_TRUE(backend->release({root[0]}).empty());
}

TEST(RealBackendIntegrationTest, ReclaimsTransientResourcesAfterSuccessAndTypedFailure) {
  const std::size_t baseline = process_resource_count();
#if defined(_WIN32)
  constexpr std::size_t kRootLeaseHandles = 2;
  constexpr std::size_t kStagingLeaseHandles = 2;
  constexpr std::size_t kFileLeaseHandles = 2;
#endif
  {
    TemporaryManagedRoot root_path;
    auto backend = make_backend();
    for (std::size_t index = 0; index < 4; ++index) {
      const auto root = backend->initialize({platform_name(), root_path.path().string()});
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline + kRootLeaseHandles);
#endif
      const std::string artifact = artifact_name_with_marker(index);
      const auto staging = backend->create_staging({root[0], "model", artifact, kNonce});
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline + kRootLeaseHandles + kStagingLeaseHandles);
#endif
      EXPECT_THROW(static_cast<void>(backend->create_staging({root[0], "model", artifact, kNonce})),
                   GuardError);
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline + kRootLeaseHandles + kStagingLeaseHandles);
#endif
      const auto file = backend->create_file({staging[0], "file-model", "384"});
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(),
                baseline + kRootLeaseHandles + kStagingLeaseHandles + kFileLeaseHandles);
#endif
      EXPECT_TRUE(backend->write_file({file[0], "resource-check"}).empty());
      EXPECT_TRUE(backend->seal_file({file[0]}).size() == 1U);
      EXPECT_TRUE(backend->release({file[0]}).empty());
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline + kRootLeaseHandles + kStagingLeaseHandles);
#endif
      EXPECT_TRUE(backend->release({staging[0]}).empty());
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline + kRootLeaseHandles);
#endif
      EXPECT_TRUE(backend->release({root[0]}).empty());
#if defined(_WIN32)
      EXPECT_EQ(process_resource_count(), baseline);
#endif
    }
  }
  EXPECT_EQ(process_resource_count(), baseline);
}

TEST(RealBackendIntegrationTest, ReclaimsResourcesAfterEveryInjectedAcquisitionFailure) {
  const std::size_t baseline = process_resource_count();
  bool completed = false;
  for (std::size_t ordinal = 1; ordinal < 512 && !completed; ++ordinal) {
    FailAtResourceAcquisition failure_injector(ordinal);
    {
      TemporaryManagedRoot root_path;
      auto backend = make_backend(failure_injector);
      try {
        complete_managed_artifact_lifecycle(*backend, root_path.path());
        EXPECT_EQ(ordinal, failure_injector.acquisition_count() + 1);
        completed = true;
      } catch (const GuardError& error) {
        EXPECT_EQ(error.code(), "IO_FAILED");
      }
    }
    EXPECT_EQ(process_resource_count(), baseline);
  }
  EXPECT_TRUE(completed);
}

TEST(RealBackendIntegrationTest, EnforcesAndReusesTheSharedLiveLeaseBudget) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});
  std::vector<std::string> staging_tokens;
  staging_tokens.reserve(kMaxLiveLeases - 1);

  for (std::size_t index = 0; index < kMaxLiveLeases - 1; ++index) {
    const auto staging =
        backend->create_staging({root[0], "model", artifact_name_with_marker(index), kNonce});
    staging_tokens.push_back(staging[0]);
  }

  try {
    static_cast<void>(backend->create_staging(
        {root[0], "model", artifact_name_with_marker(kMaxLiveLeases - 1), kNonce}));
    FAIL() << "the 65th live lease must be rejected";
  } catch (const GuardError& error) {
    EXPECT_EQ(error.code(), "IO_FAILED");
  }

  EXPECT_TRUE(backend->release({staging_tokens.front()}).empty());
  const auto replacement = backend->create_staging(
      {root[0], "model", artifact_name_with_marker(kMaxLiveLeases - 1), kNonce});
  EXPECT_EQ(replacement[0], "lease-65");

  EXPECT_TRUE(backend->release({replacement[0]}).empty());
  for (const std::string& token : staging_tokens) {
    EXPECT_TRUE(backend->release({token}).empty());
  }
  EXPECT_TRUE(backend->release({root[0]}).empty());
}

TEST(RealBackendIntegrationTest, RequiresAnExactTypedListExpectation) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});
  const auto staging = backend->create_staging({root[0], "model", kArtifactName, kNonce});
  const auto file = backend->create_file({staging[0], "file-model", "384"});
  EXPECT_TRUE(backend->write_file({file[0], "exact-list"}).empty());
  EXPECT_TRUE(backend->seal_file({file[0]}).size() == 1U);
  EXPECT_TRUE(backend->release({file[0]}).empty());

  const std::vector<ExpectedEntry> exact = {{"file-model", FileMode{384U}}};
  EXPECT_NO_THROW(static_cast<void>(backend->list({staging[0], exact})));
  EXPECT_THROW(
      static_cast<void>(backend->list({staging[0], {{"managed-manifest-v1", FileMode{384U}}}})),
      GuardError);
  EXPECT_THROW(
      static_cast<void>(backend->list(
          {staging[0], {{"file-model", FileMode{384U}}, {"managed-manifest-v1", FileMode{384U}}}})),
      GuardError);
  EXPECT_THROW(static_cast<void>(backend->list({staging[0], {{"file-model", FileMode{0U}}}})),
               GuardError);

  EXPECT_TRUE(backend->release({staging[0]}).empty());
  EXPECT_TRUE(backend->release({root[0]}).empty());
}

TEST(RealBackendIntegrationTest, GuardApplicationUsesTheRealBackendThroughStreams) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  GuardApplication application(*backend);
  const std::string request = "1\t1\tINIT\t" + base64url_encode(platform_name()) + "\t" +
                              base64url_encode(root_path.path().string()) + "\n";
  std::istringstream input(request);
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_TRUE(output.str().starts_with("1\t1\tOK\t"));
}

#if defined(_WIN32)
TEST(RealBackendIntegrationTest, RejectsHardLinksCaseAliasesAndJunctions) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});

  const auto staging = backend->create_staging({root[0], "model", kArtifactName, kNonce});
  const auto file = backend->create_file({staging[0], "file-model", "384"});
  EXPECT_TRUE(backend->write_file({file[0], "hello"}).empty());
  EXPECT_TRUE(backend->seal_file({file[0]}).size() == 1U);
  EXPECT_TRUE(backend->release({file[0]}).empty());
  const auto staged_path =
      root_path.path() / "staging" / ("stage-" + kArtifactName + "-" + kNonce) / "file-model";
  const auto outside_link = root_path.path().parent_path() / "outside-hardlink";
  ASSERT_NE(CreateHardLinkW(outside_link.c_str(), staged_path.c_str(), nullptr), FALSE);
  EXPECT_THROW(static_cast<void>(backend->list({staging[0], {"file-model|384"}})), GuardError);
  ASSERT_NE(DeleteFileW(outside_link.c_str()), FALSE);

  std::string case_alias = kArtifactName;
  case_alias[0] = 'M';
  EXPECT_THROW(static_cast<void>(backend->open_artifact({root[0], "models", case_alias})),
               GuardError);

  const auto junction = root_path.path() / "models" / kArtifactName;
  const auto junction_target = root_path.path().parent_path() / "junction-target";
  create_junction(junction, junction_target);
  EXPECT_EQ(backend->list_namespace({root[0], "models"}), ResponseFields({"unmanaged-entry"}));
  ASSERT_NE(RemoveDirectoryW(junction.c_str()), FALSE);

  EXPECT_TRUE(backend->release({staging[0]}).empty());
  EXPECT_TRUE(backend->release({root[0]}).empty());
}
#endif

#if !defined(_WIN32)
TEST(RealBackendIntegrationTest, ReportsAUnixSymlinkAsUnmanaged) {
  TemporaryManagedRoot root_path;
  auto backend = make_backend();
  const auto root = backend->initialize({platform_name(), root_path.path().string()});
  std::error_code error;
  const auto link = root_path.path() / "models" / kArtifactName;
  std::filesystem::create_directory_symlink(root_path.path().parent_path(), link, error);
  ASSERT_FALSE(error);

  const auto names = backend->list_namespace({root[0], "models"});
  EXPECT_EQ(names, ResponseFields({"unmanaged-entry"}));
  EXPECT_TRUE(backend->release({root[0]}).empty());
}
#endif

} // namespace
} // namespace local_whisper::fs_guard
