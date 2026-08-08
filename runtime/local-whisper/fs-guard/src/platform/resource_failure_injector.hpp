#pragma once

namespace local_whisper::fs_guard {

// Test-only implementations are injected into a backend instance; production
// construction leaves this boundary unset. The callback runs immediately
// before an OS call that can acquire a resource.
class ResourceFailureInjector {
public:
  virtual ~ResourceFailureInjector() = default;

  virtual void before_resource_acquisition() = 0;
};

} // namespace local_whisper::fs_guard
