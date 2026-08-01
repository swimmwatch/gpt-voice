#define NOMINMAX

#ifdef _WIN32
#include <windows.h>
#else
#include <csignal>
#include <sys/types.h>
#include <unistd.h>
#endif

#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>

namespace {

constexpr std::string_view kWorkerArgument = "--local-whisper-worker-v1";
constexpr std::string_view kDescendantArgument = "--local-whisper-descendant-fixture-v1";

[[noreturn]] void wait_forever() {
  while (true)
    std::this_thread::sleep_for(std::chrono::seconds(1));
}

#ifdef _WIN32

std::wstring executable_path() {
  std::wstring value(32'768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, value.data(), static_cast<DWORD>(value.size()));
  if (length == 0 || static_cast<std::size_t>(length) >= value.size())
    throw std::runtime_error("fixture executable path unavailable");
  value.resize(length);
  return value;
}

DWORD spawn_descendant() {
  const std::wstring executable = executable_path();
  std::wstring command = L"fixture-descendant --local-whisper-descendant-fixture-v1";
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  if (!CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW,
                      nullptr, nullptr, &startup, &process)) {
    throw std::runtime_error("fixture descendant spawn failed");
  }
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  return process.dwProcessId;
}

std::uint64_t current_pid() { return GetCurrentProcessId(); }

#else

pid_t spawn_descendant() {
  const pid_t child = fork();
  if (child < 0)
    throw std::runtime_error("fixture descendant spawn failed");
  if (child == 0)
    wait_forever();
  return child;
}

std::uint64_t current_pid() { return static_cast<std::uint64_t>(getpid()); }

#endif

void write_state(std::uint64_t descendant_pid) {
  std::ofstream output("launcher-fixture-state", std::ios::binary | std::ios::trunc);
  output << current_pid() << '\n' << descendant_pid << '\n';
  output.flush();
  if (!output)
    throw std::runtime_error("fixture state write failed");
}

int run_worker() {
#ifndef _WIN32
  if (std::filesystem::exists("launcher-fixture-ignore-term"))
    std::signal(SIGTERM, SIG_IGN);
#endif
  const auto descendant = static_cast<std::uint64_t>(spawn_descendant());
  write_state(descendant);
  char buffer[4096];
  while (std::cin.read(buffer, sizeof(buffer)) || std::cin.gcount() > 0) {
  }
  wait_forever();
}

} // namespace

int main(int argc, char** argv) {
  try {
    if (argc != 2)
      return 2;
    const std::string_view argument(argv[1]);
    if (argument == kDescendantArgument)
      wait_forever();
    if (argument != kWorkerArgument)
      return 2;
    return run_worker();
  } catch (...) {
    return 10;
  }
}
