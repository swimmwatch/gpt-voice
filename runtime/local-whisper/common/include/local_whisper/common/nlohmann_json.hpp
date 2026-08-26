#pragma once

// MSVC /analyze C6294 is a false positive in the reviewed nlohmann/json 3.12.0
// header. Keep the suppression at the third-party inclusion boundary so every
// project-owned translation unit remains subject to /W4, /WX, and /analyze.
#if defined(_MSC_VER)
#pragma warning(push)
#pragma warning(disable : 6294)
#endif

#include <nlohmann/json.hpp>

#if defined(_MSC_VER)
#pragma warning(pop)
#endif
