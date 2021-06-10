# ui5-task-adaptation
[![REUSE status](https://api.reuse.software/badge/github.com/SAP/ui5-task-adaptation)](https://api.reuse.software/info/github.com/SAP/ui5-task-adaptation)

## Description
A custom task for [ui5-builder](https://github.com/SAP/ui5-builder) that allows building [UI5 Flexibility adaptation projects](https://help.sap.com/viewer/584e0bcbfd4a4aff91c815cefa0bce2d/Cloud/en-US/019b0c38a6b043d1a66b11d992eed290.html) for SAP BTP, Cloud Foundry environment.

## How to specify a UI5 version
ui5-task-adaptation is based on the UI5 implementation. In order to use a certain UI5 version, go to a module that contains the ui5.yaml and edit the ui5.yaml specifying the desired UI5 version (1.89.0 in the example below):

```yaml
---
specVersion: "2.2"
type: application
metadata:
  name: example
framework:
  name: SAPUI5
  version: 1.89.0
  libraries:
    - name: sap.ui.fl
    - name: sap.suite.ui.generic.template
```

open a terminal and execute:

```shell
npm run build-ui5
```


## How to obtain support
In case you need any support, please create a GitHub issue.

## License
Copyright (c) 2020 SAP SE or an SAP affiliate company. All rights reserved. This file and all other files in this repository are licensed under the Apache License, v 2.0 except as noted otherwise in the [LICENSE file](LICENSE).

## Release History
See [CHANGELOG.md](CHANGELOG.md).