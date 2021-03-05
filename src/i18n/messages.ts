export const Messages = {
	HTML5_REPO_RUNTIME_NOT_FOUND: "HTML5 Repository Runtime service cannot be found, please check your organization entitlements",
	FAILED_TO_CREATE_SERVICE_INSTANCE: (serviceInstanceName: string, spaceGuid: string, error: string) => `Cannot create a service instance '${serviceInstanceName}' in space '${spaceGuid}': ${error}`,
	FAILED_TO_PARSE_RESPONSE_FROM_CF: (error: string) => `Failed parse response from request CF API: ${error}`,
	RETRY_MESSAGE: (params: string[]) => `Failed to send request with parameters '${JSON.stringify(params)}'`,
	RETRY_ATTEMPT: (error: string, attempt: number) => `${attempt + 1} attempt: ${error}`,
	COULD_NOT_CREATE_SERVICE_KEY_ERR_MSG: (instance: string) => `Couldn't create a service key for instance: ${instance}`,
};