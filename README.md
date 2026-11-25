# ui5-task-adaptation
[![REUSE status](https://api.reuse.software/badge/github.com/SAP/ui5-task-adaptation)](https://api.reuse.software/info/github.com/SAP/ui5-task-adaptation)
[![Build Status](https://app.travis-ci.com/SAP/ui5-task-adaptation.svg?branch=main)](https://app.travis-ci.com/github/SAP/ui5-task-adaptation)
[![npm version](https://badge.fury.io/js/@ui5%2Ftask-adaptation.svg)](https://badge.fury.io/js/@ui5%2Ftask-adaptation)

## Description
A custom task for [ui5-builder](https://github.com/SAP/ui5-builder) that allows you to build SAPUI5 adaptation projects for [SAP S/4HANA Cloud](https://help.sap.com/docs/bas/584e0bcbfd4a4aff91c815cefa0bce2d/6fc4e11a4b1941efa8e37a428d046f8f.html?locale=en-US&state=PRODUCTION&version=Cloud) and [SAP BTP, Cloud Foundry environment](https://help.sap.com/viewer/584e0bcbfd4a4aff91c815cefa0bce2d/Cloud/en-US/019b0c38a6b043d1a66b11d992eed290.html).

The package exports the following functions:

- **Default export**: custom task for [ui5-builder](https://ui5.github.io/cli/v4/pages/extensibility/CustomTasks/); builds an app variant bundle from project resources.
- **`previewManifest`**: applies manifest changes to `manifest.json` and returns the updated manifest. Used to preview manifest changes at development time.
- **`downloadAppResources`**: downloads original application files and following app-variant hierarchy, builds the base application to a local output directory (SAP S/4HANA, SAP S/4HANA Cloud, or SAP BTP Cloud Foundry and ABAP environments). Used by [open-ux-tools](https://github.com/SAP/open-ux-tools) to fetch base applications sources of selected SAP Fiori applications.

### Configuration
#### Connection
When creating an adaptation project, the Yeoman generator automatically generates the following connection configurations in the `ui5.yaml` file, depending on your IDE:

For local IDEs like VS Code:
```yaml
target:
  url: example.com,
  authenticationType: reentranceTicket,
  ignoreCertErrors: true | false
```
In SAP Business Application Studio:
```yaml
target:
  destination: abc
```

For more information, see [Create an Adaptation Project](https://help.sap.com/docs/bas/developing-sap-fiori-app-in-sap-business-application-studio/create-project) (on SAP S/4HANA Cloud) or [Create an Adaptation Project](https://help.sap.com/docs/bas/developing-sap-fiori-app-in-sap-business-application-studio/create-adaptation-project-c7b455d488bc4229af7efe0311546752) (on SAP BTP, Cloud Foundry environment).
> [!NOTE]  
> For SAP S/4HANA (on-premise) systems, a different builder is used.

#### Debugging annotations
Set `enableDebug: true` in the adaptation task's `configuration` in `ui5.yaml` to save downloaded annotation XML files under `.adp/debug/annotations` in the project root. This is disabled by default.

```yaml
builder:
  customTasks:
    - name: app-variant-bundler-build
      beforeTask: escapeNonAsciiCharacters
      configuration:
        enableDebug: true
        # Keep your existing connection and language configuration here.
```

The files contain the original responses before annotation conversion and translation processing, including OData metadata and referenced annotations for every downloaded language. Filenames use the sanitized request URI and a hash to keep different URLs and languages separate. Repeated downloads of the same URI overwrite its debug file. Debug files are separate from the generated application resources.


## Branch Structure
* `main` (npm `latest`) — The stable version, ready for production use.
* `rc` (npm `alpha`) — Alpha prereleases for active development. The code here may be unstable and features are subject to change. Use at your own risk.

Release Please uses `release-please-config.json` for stable releases from `main` and `release-please-config.rc.json` for `alpha` versions and GitHub prereleases from `rc`. Each branch tracks its current version in `.release-please-manifest.json`.


## How to obtain support
In case you need any support, please create a [GitHub issue](https://github.com/SAP/ui5-task-adaptation/issues).

## License
Copyright (c) 2020 SAP SE or an SAP affiliate company. All rights reserved. This file and all other files in this repository are licensed under the Apache License, v 2.0 except as noted otherwise in the [LICENSE file](LICENSE).

## Release History
See [CHANGELOG.md](CHANGELOG.md).

## Contributing
Please refer to the [SAP Contribution Guidelines](https://github.com/SAP/.github/blob/main/CONTRIBUTING.md) for instructions on how to contribute to ui5-task-adaptation.
