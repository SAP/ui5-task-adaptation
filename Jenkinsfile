#!/usr/bin/env groovy
@Library(value=['piper-lib-os@v1.131.0', 'piper-lib@1.103.0'], changelog=false) _

import com.sap.icd.jenkins.Utils
import com.sap.piper.internal.JenkinsUtils

def slackNotification = false;

try {
    if (env.BRANCH_NAME.startsWith('PR')) {
        localBuildStage(10)
    } else if (env.BRANCH_NAME == 'master') {
        slackNotification = true;
        localBuildStage(10)
    } else {
        // not a branch we should work on at all, so no slack msg
        echo "Nothing to do in pipeline. Branch name: ${env.BRANCH_NAME}"
    }

    // if we get here, all is fine
    currentBuild.result = "SUCCESS"

} catch (Throwable e) {
    globalPipelineEnvironment.addError(this, e)
    throw e
} finally {
    sendBuildResultNotification(env.BRANCH_NAME, slackNotification)
}

def localBuildStage(progress) {
    dockerExecute(script: this, dockerWorkspace: '/home/node', dockerImage: 'docker.wdf.sap.corp:50000/chrome-docker') {
        sh "npm install && npm run test"
    }
}