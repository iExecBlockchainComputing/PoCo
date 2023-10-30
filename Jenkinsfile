// TODO[optionnal]: Use scripted pipeline
pipeline {
    environment {
        nodeJsImage = 'node:18'
    }
    agent any
    stages {
        stage('Init') {
            agent {
                docker {
                    reuseNode true
                    image nodeJsImage
                }
            }
            steps {
                script {
                    sh 'npm ci --production=false --no-progress'
                    sh 'npm run build'
                    sh 'npm run test-storage-layout'
                    // Verify basic deployment. Might be removed at some point.
                    sh 'npm run deploy'
                }
            }
        }
        stage('Hardhat tests - Public') {
            agent {
                docker {
                    reuseNode true
                    image nodeJsImage
                }
            }
            steps {
                script {
                    test()
                }
            }
        }
        stage('Hardhat tests - KYC') {
            agent {
                docker {
                    reuseNode true
                    image nodeJsImage
                }
            }
            environment {
                KYC = 'true'
            }
            steps {
                script {
                    test()
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
            agent {
                docker {
                    reuseNode true
                    image 'trailofbits/eth-security-toolbox:latest'
                    args "-e SOLC='0.8.21' --entrypoint="
                }
            }
            steps {
                script {
                    try {
                        sh 'solc-select install $SOLC && slither --solc-solcs-select $SOLC contracts/modules/delegates/IexecPocoBoostDelegate.sol'
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
