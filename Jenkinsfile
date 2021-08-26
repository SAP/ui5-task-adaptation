#!/usr/bin/env groovy
@Library(value=['piper-lib-os@v1.131.0', 'piper-lib@1.103.0'], changelog=false) _

import com.sap.icd.jenkins.Utils
import com.sap.piper.internal.JenkinsUtils

try {
    if (env.BRANCH_NAME.startsWith('PR')) {
        localBuildStage(false)
    } else if (env.BRANCH_NAME == 'master') {
        localBuildStage(true)
    } else {
        // not a branch we should work on at all, so no slack msg
        echo "Nothing to do in pipeline. Branch name: ${env.BRANCH_NAME}"
    }
} catch (Throwable e) {
    globalPipelineEnvironment.addError(this, e)
    throw e
} finally {
    sendBuildResultNotification()
}

def localBuildStage(isNightly) {
    node {
        deleteDir()
        checkout scm
        if (isNightly) {
            setupPipelineEnvironment script: this, productiveBranch: 'master', runNightly: true, nightlySchedule: 'H 1 * * *'
        }

    	dockerExecute(script: this, dockerWorkspace: '/home/node', dockerImage: 'docker.wdf.sap.corp:50000/node') {
            sh "node -v"
            sh "npm install && npm run test"
        }
    }
}

def sendBuildResultNotification() {
    stage('Result notification') {
        node {
            echo "Build result notification"
            if (currentBuild.result != "SUCCESS") {
                notifyBuildFailed()
            }
        }
    }
}


def notifyBuildFailed() {
    node {
        def dotGitExists = fileExists '.git'
        if (!dotGitExists) {
            checkout scm
        }
        def committerEmail = sh(returnStdout: true, script: 'git log -n 1 --format="%ae"').trim()
        def subject = "${currentBuild.result}: Build ${currentBuild.fullProjectName} ${currentBuild.displayName}"
        def body = "The current Jenkins job ${currentBuild.result} for jobname: ${env.JOB_NAME}, job url: ${env.BUILD_URL}. Please check the attached logs for error details."
        emailext (
           to: committerEmail,
           subject: subject,
           body: body,
           attachLog: true
        )
    }
}
