// TODO[optionnal]: Use scripted pipeline
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
                            slitherRequested = "${env.GIT_BRANCH}" == 'feature/slither-ci'
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
                // TODO: Run tests in native mode (Not required in KYC)
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
         *  -e SOLC='<solc-version>' trailofbits/eth-security-toolbox -c \
         *  'cd /share && solc-select install $SOLC && \
         *  slither --solc-solcs-select $SOLC <contract-path>'
         */
        stage('Slither') {
            when { expression { return slitherRequested } }
            agent {
                docker {
                    image 'trailofbits/eth-security-toolbox:latest'
                    args '--entrypoint= -e SOLC=0.8.21'
                }
            }
            steps {
                script {
                    try {
                        unstash 'node_modules'
                        sh """
                        cd /share && solc-select install $SOLC &&
                        slither --solc-solcs-select $SOLC
                        contracts/modules/delegates/IexecPocoBoostDelegate.sol
                        """
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
