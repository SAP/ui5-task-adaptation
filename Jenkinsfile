#!/usr/bin/env groovy
@Library(value=['piper-lib-os@v1.131.0', 'piper-lib@1.103.0'], changelog=false) _

import com.sap.icd.jenkins.Utils
import com.sap.piper.internal.JenkinsUtils

def slackNotification = false;

try {
    if (env.BRANCH_NAME.startsWith('PR')) {
        localBuildStage(10)
    } else if (env.BRANCH_NAME == 'master') {
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
    node {
        deleteDir()
        checkout scm

    	dockerExecute(script: this, dockerWorkspace: '/home/node', dockerImage: 'docker.wdf.sap.corp:50000/chrome-docker') {
            sh "npm install && npm run test"
        }
    }
}

def sendBuildResultNotification(deployEnv, slackNotification) {
    stage('Result notification') {
        node {
            echo "Build result notification"
            if (currentBuild.result != "SUCCESS") {
                notifyBuildFailed(deployEnv, slackNotification)
            }
        }
    }
}


def notifyBuildFailed(deployEnv, slackNotification) {
    node {
        /*
        * We may end up here on an empty workspace. Since the (notifcationMail()) requires the .git folder to retrieve the latest committer,
        * we check for the existence of the .git folder, and if necessary, checkout scm again
        */
        def dotGitExists = fileExists '.git'
        if (!dotGitExists) {
            checkout scm
        }
        def message = "${currentBuild.result}: Job ${env.JOB_NAME} <${env.BUILD_URL}|#${env.BUILD_NUMBER}>"
        def committerEmail = sh(returnStdout: true, script: 'git log -n 1 --format="%ae"').trim()
        def subject = "${currentBuild.result}: Build ${currentBuild.fullProjectName} ${currentBuild.displayName}"
        def body = "The current Jenkins job failed for jobname: ${env.JOB_NAME}, job url: ${env.BUILD_URL}. Please check the attached logs for error details."
        emailext (
           to: committerEmail,//'DL_5EC26BC8F86611027EAC0886@global.corp.sap',
           subject: subject,
           body: body,
           attachLog: true
        )
    }
}
