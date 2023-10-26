// TODO1 Remove useless build stages & use scripted pipeline
// TODO2 Run unit tests on token AND native? -> IexecEscrowNative.js, all others
def slitherRequested = false
pipeline {
    agent any
    stages {
        stage('Test') {
            agent { docker { image 'node:18' } }
            stages {
                stage('Init') {
                    steps {
                        script {
                            sh "echo ${env.GIT_BRANCH}"
                            println slitherRequested
                            slitherRequested = "${env.GIT_BRANCH}" == 'feature/slither-ci'
                            println slitherRequested
                            sh 'npm ci --production=false --no-progress'
                            sh 'npm run test-storage-layout'
                            // Verify basic deployment. Might be removed at some point.
                            sh 'npm run deploy'
                            if (slitherRequested) {
                                stash includes: 'node_modules/**/*', name: 'node_modules'
                            }
                        }
                    }
                }
                stage('Hardhat tests - Public') {
                    steps {
                        script {
                            test()
                        }
                    }
                }
                stage('Hardhat tests - KYC') {
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

        /**
         * Usage example:
         * docker run --rm --entrypoint /bin/bash -v $(pwd):/share \
         *  trailofbits/eth-security-toolbox -c \
         *  'cd /share && solc-select install <solc-version> && slither <contract-path>'
         */
        stage('Slither') {
            when { expression { return slitherRequested } }
            agent {
                docker {
                    image 'trailofbits/eth-security-toolbox:latest'
                    args '--entrypoint='
                }
            }
            steps {
                script {
                    try {
                        unstash 'node_modules'
                        sh 'solc-select install 0.8.21 && slither contracts/modules/delegates/IexecPocoBoostDelegate.sol'
                    } catch (err) {
                        sh "echo ${STAGE_NAME} stage is unstable"
                    }
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
