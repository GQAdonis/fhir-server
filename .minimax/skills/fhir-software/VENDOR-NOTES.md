# Project notes for the vendored fhir-software skill

This file is added by the WSO2 FHIR Server / TribeHealth project. The upstream files in this directory are unmodified.

This repository is a **Go** FHIR server. Use the skill for FHIR knowledge (resources, search, validation, SMART, FSH) and follow these restrictions:

- **Do not install the packages the skill mentions.** `@fhir/package-loader` (npm), `fhir-package-loader` (PyPI) and `httpx-test` (PyPI) were **not registered** as of 2026-09-25 (registry 404). Installing them would expose you to typosquatting or slopsquatting. Also do not install from `assets/requirements.txt` or `assets/package.json`, which use floating version ranges.
- **Do not run `scripts/fhir_package_manager.py`.** It has no network timeouts, extracts archives without member filtering (tar-slip/zip-slip), and trusts any tarball host. Load IG packages through the server's own loader (`internal/ig`).
- **`assets/fhir_server.py` is an insecure example.** It allows all CORS origins with credentials and binds to `0.0.0.0`. Don't copy its patterns.
- Patient data rules come from the `phi-lane-policy` skill, which overrides anything here.
