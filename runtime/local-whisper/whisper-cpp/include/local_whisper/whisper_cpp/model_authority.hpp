#pragma once

#include "local_whisper/common/model_authority.hpp"
#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include <memory>

namespace local_whisper::whisper_cpp {

/** Deprecated descriptor/handle model authority retained for rollback/reference tests only. */
class ModelAuthorityView {
public:
  virtual ~ModelAuthorityView() = default;
  [[nodiscard]] virtual const local_whisper::common::AuthorityBinding& binding() const noexcept = 0;
  [[nodiscard]] virtual RandomAccessModelSource& source() noexcept = 0;
};

class ModelAuthority final : public ModelAuthorityView {
public:
  static ModelAuthority receive_from_standard_channels();

  ~ModelAuthority() noexcept override;
  ModelAuthority(ModelAuthority&&) noexcept;
  ModelAuthority& operator=(ModelAuthority&&) noexcept;
  ModelAuthority(const ModelAuthority&) = delete;
  ModelAuthority& operator=(const ModelAuthority&) = delete;

  [[nodiscard]] const local_whisper::common::AuthorityBinding& binding() const noexcept override;
  [[nodiscard]] RandomAccessModelSource& source() noexcept override;

private:
  class Impl;
  explicit ModelAuthority(std::unique_ptr<Impl> impl);

  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::whisper_cpp
