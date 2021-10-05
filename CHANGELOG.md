# Changelog
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

A list of unreleased changes can be found [here](https://github.com/SAP/ui5-task-adaptation/compare/v1.0.10...HEAD).

<a name="v1.0.10"></a>
## [v1.0.10] - 2021-06-04
### Fixes
* Shouldn't fill change layer if layer is undefined ([#20](https://github.com/SAP/ui5-task-adaptation/pull/20)) ([7374c39](https://github.com/SAP/ui5-task-adaptation/commit/7374c392b7aa4fbae45936391e3b3b53fbb27cb4))
* Add appVariantIdHierarchy in the beginning of hierarchy list ([#21](https://github.com/SAP/ui5-task-adaptation/pull/21)) ([f15dd48](https://github.com/SAP/ui5-task-adaptation/commit/f15dd48d6f0fecefa882718099ec27ee72f1fb1d))

<a name="v1.0.9"></a>
## [v1.0.9] - 2021-05-10
### Features
* Handle requireAsync.bind of sap.ui.fl libraries ([#18](https://github.com/SAP/ui5-task-adaptation/pull/18)) ([246af7f](https://github.com/SAP/ui5-task-adaptation/commit/246af7f50987048a3112298f9142708628577bee))
* Fill changes layer property ([#17](https://github.com/SAP/ui5-task-adaptation/pull/17)) ([6083cca](https://github.com/SAP/ui5-task-adaptation/commit/6083cca20dbd00a41fdad110b745f13be5775973))

<a name="v1.0.8"></a>
## [v1.0.8] - 2021-04-26
### Features
* Introduce update cache API ([#15](https://github.com/SAP/ui5-task-adaptation/pull/15)) ([9e5033b](https://github.com/SAP/ui5-task-adaptation/commit/9e5033b35865c9f93519dacf0d3ab1bee8d038df))

<a name="v1.0.7"></a>
## [v1.0.7] - 2021-04-23
### Fixes
* Skip manifest-bundle.zip during build process ([#5](https://github.com/SAP/ui5-task-adaptation/pull/5)) ([534e3c2](https://github.com/SAP/ui5-task-adaptation/commit/534e3c206ab26e240ee0e59fa7cbef912aa8e8f7))
* API improvements for adaptation generators ([#14](https://github.com/SAP/ui5-task-adaptation/pull/14)) ([0b9166b](https://github.com/SAP/ui5-task-adaptation/commit/0b9166bc07a0d48622ff12a4ff1779724b205f17))

<a name="v1.0.6"></a>
## [v1.0.6] - 2021-04-12
### Features
* Introduce npm releases ([#13](https://github.com/SAP/ui5-task-adaptation/pull/13)) ([1b005de](https://github.com/SAP/ui5-task-adaptation/commit/1b005ded532701cd3a5abee647b02170f0c75e77))

<a name="v1.0.5"></a>
## [v1.0.5] - 2021-04-12

<a name="v1.0.4"></a>
## [v1.0.4] - 2021-04-12

<a name="v1.0.3"></a>
## [v1.0.3] - 2021-04-12
### Features
* Introduced types and code is rewritten in typescript ([#1](https://github.com/SAP/ui5-task-adaptation/pull/1)) ([8f0b194](https://github.com/SAP/ui5-task-adaptation/commit/8f0b194a5cc3122d064d9e6c6ba6d38798188f57))
* Handle requireAsync of sap.ui.fl libraries ([#10](https://github.com/SAP/ui5-task-adaptation/pull/10)) ([9af62d8](https://github.com/SAP/ui5-task-adaptation/commit/9af62d8b13b71a8c0219ee4044c5430272eb6e9c))
* Use internal ui5 API to get latest UI5 version ([#12](https://github.com/SAP/ui5-task-adaptation/pull/12)) ([bc2560b](https://github.com/SAP/ui5-task-adaptation/commit/bc2560bd091dbfcd00b1eb42a916f2a25898b52a))

### Fixes
* Replace request with node-fetch ([#4](https://github.com/SAP/ui5-task-adaptation/pull/4)) ([15c361c](https://github.com/SAP/ui5-task-adaptation/commit/15c361ca2f7738967b0ea00171f1acab0580a685))


<a name="v1.0.2"></a>
## [v1.0.2] - 2021-02-17
### Features
* Enforce public npm registry ([a8c9ba7](https://github.com/SAP/ui5-task-adaptation/commit/a8c9ba722c6fdcf4a3da7a455d24a5584ebab5e0))

<a name="v1.0.1"></a>
## [v1.0.1] - 2021-02-10
### Features
* Introduce bundling of sap.ui.fl libraries instead of using ui5-loader ([#3](https://github.com/SAP/ui5-task-adaptation/pull/3)) ([7acf1b5](https://github.com/SAP/ui5-task-adaptation/commit/7acf1b5badf7a85ee3b212f6d2388f314f0ca025))
* Update sap.platform.cf and sap.cloud in manifest.json, create html5 instance if necessary ([#4](https://github.com/SAP/ui5-task-adaptation/pull/4)) ([9d91772](https://github.com/SAP/ui5-task-adaptation/commit/9d917722eb5fc1d9326558b5a6a23b78d5f1836d))
* Use CloudFoundry API V3 ([9d91772](https://github.com/SAP/ui5-task-adaptation/commit/9d917722eb5fc1d9326558b5a6a23b78d5f1836d))
* Use user provided UI5 version, otherwise fallback to the latest ([710fb46](https://github.com/SAP/ui5-task-adaptation/commit/710fb469714cd8ce3a8f2825d36f06733281eebc))
* Use internal project settings for rollup ([#6](https://github.com/SAP/ui5-task-adaptation/pull/6)) ([2ea9175](https://github.com/SAP/ui5-task-adaptation/commit/2ea917548ac90853a4f989f32e90fd61f99d8d2b))
### Fixes
* Adapt brand name ([#5](https://github.com/SAP/ui5-task-adaptation/pull/5)) ([7fec18d](https://github.com/SAP/ui5-task-adaptation/commit/7fec18d15b3e8991db1414a3cb1d1c6c24f29124))

<a name="v1.0.0"></a>
## v1.0.0 - 2020-12-09
### Features
* Added source code and licenses, checked with reuse tool ([#1](https://github.com/SAP/ui5-task-adaptation/pull/1)) ([42d6538](https://github.com/SAP/ui5-task-adaptation/commit/42d653871b9387351c3c5280b12b55c09107f7d4))

[v1.0.10]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.9...v1.0.10
[v1.0.9]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.8...v1.0.9
[v1.0.8]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.7...v1.0.8
[v1.0.7]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.6...v1.0.7
[v1.0.6]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.5...v1.0.6
[v1.0.5]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.4...v1.0.5
[v1.0.4]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.3...v1.0.4
[v1.0.3]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.2...v1.0.3
[v1.0.2]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/SAP/ui5-task-adaptation/compare/v1.0.0...v1.0.1
