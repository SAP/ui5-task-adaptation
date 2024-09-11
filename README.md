# ui5-task-adaptation
[![REUSE status](https://api.reuse.software/badge/github.com/SAP/ui5-task-adaptation)](https://api.reuse.software/info/github.com/SAP/ui5-task-adaptation)
[![Build Status](https://app.travis-ci.com/SAP/ui5-task-adaptation.svg?branch=main)](https://app.travis-ci.com/github/SAP/ui5-task-adaptation)
[![npm version](https://badge.fury.io/js/@ui5%2Ftask-adaptation.svg)](https://badge.fury.io/js/@ui5%2Ftask-adaptation)

## Description
A custom task for [ui5-builder](https://github.com/SAP/ui5-builder) that allows building SAPUI5 adaptation projects for [SAP S/4HANA Cloud](https://help.sap.com/docs/bas/584e0bcbfd4a4aff91c815cefa0bce2d/6fc4e11a4b1941efa8e37a428d046f8f.html?locale=en-US&state=PRODUCTION&version=Cloud) and [SAP BTP, Cloud Foundry environment](https://help.sap.com/viewer/584e0bcbfd4a4aff91c815cefa0bce2d/Cloud/en-US/019b0c38a6b043d1a66b11d992eed290.html).

### Configuration
#### ABAP Connection
The following connection configuration format is used to connect to ABAP repository on SAP BAS and IDE:
```yaml
connections:
    - url: example.com,
      authenticationType: basic | reentranceTicket,
      ignoreCertErrors: true | false
    - destination: abc
```
In case multiple connection configuration are present, then the current environment configuration will be used. For example in above case `destination` for SAP BAS or `url` for IDE will be automaticaly used.
OnPremise ABAP repository requires `authenticationType: basic`, credentials should be provided in project root `.env` file:
```
FIORI_TOOLS_USER=<username>
FIORI_TOOLS_PASSWORD=<password>
```
Whereas S4/Hana uses `authenticationType: reentranceTicket` to authentificate. A browser window will be opened.

## How to obtain support
In case you need any support, please create a [GitHub issue](https://github.com/SAP/ui5-task-adaptation/issues).

## License
Copyright (c) 2020 SAP SE or an SAP affiliate company. All rights reserved. This file and all other files in this repository are licensed under the Apache License, v 2.0 except as noted otherwise in the [LICENSE file](LICENSE).

## Release History
See [CHANGELOG.md](CHANGELOG.md).