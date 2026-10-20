// Package version exposes the build version of the poketools binary.
package version

import "runtime/debug"

// Version is the release version. It is overridden at build time via
//
//	-ldflags "-X github.com/dariomendez/poketools/internal/version.Version=v1.0.0"
//
// (see the Makefile and Dockerfile, which feed it `git describe`). When built
// without that flag — e.g. `go build`, `go test`, `go run` — it falls back to
// the VCS revision Go embeds in the build info, or "dev" as a last resort.
var Version = ""

// String returns the resolved version, applying the build-info fallback.
func String() string {
	if Version != "" {
		return Version
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		var rev, dirty string
		for _, s := range info.Settings {
			switch s.Key {
			case "vcs.revision":
				rev = s.Value
			case "vcs.modified":
				if s.Value == "true" {
					dirty = "-dirty"
				}
			}
		}
		if rev != "" {
			if len(rev) > 12 {
				rev = rev[:12]
			}
			return rev + dirty
		}
	}
	return "dev"
}
