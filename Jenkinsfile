// TODO1 Remove useless build stages & use scripted pipeline
// TODO2 Run unit tests on token AND native? -> IexecEscrowNative.js, all others
pipeline {
    agent any
    environment {
        NODES_JS_IMAGE = 'node:18'
    }
    stages {
        stage('Init') {
            agent { docker { image "$NODES_JS_IMAGE" } }
            steps {
                script {
                    sh 'npm ci --production=false --no-progress'
                    sh 'npm run test-storage-layout'
                    // Verify basic deployment. Might be removed at some point.
                    sh 'npm run deploy'
                }
            }
        }
        stage('Slither') {
            agent {
                docker {
                    image 'trailofbits/eth-security-toolbox:latest'
                    args '--entrypoint='
                }
            }
            steps {
                script {
                    sh 'solc-select install 0.8.17 && slither contracts/modules/delegates/IexecPocoBoostDelegate.sol'
                }
            }
        }
        stage('Hardhat tests - Public') {
            agent { docker { image "$NODES_JS_IMAGE" } }
            steps {
                script {
                    test()
                }
            }
        }
        stage('Hardhat tests - KYC') {
            agent { docker { image "$NODES_JS_IMAGE" } }
            environment {
                KYC = 'true'
            }
            steps {
                script {
                    test()
                }
            }
        }
    }
}

def test() {
    try {
        sh 'npm run coverage'
    } catch (Exception e) {
        echo 'Exception occurred: ' + e.toString()
        runEachTestWithDedicatedLogFile()
    } finally {
        archiveArtifacts artifacts: 'coverage/**'
    }
}

def runEachTestWithDedicatedLogFile() {
    try {
        sh './test.sh'
    } finally {
        archiveArtifacts artifacts: 'logs/**'
    }
}
