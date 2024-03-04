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
        stage('Hardhat tests') {
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
                    // At this time, trailofbits/eth-security-toolbox packages
                    // an old slither version, hence we use another Docker image
                    // (which is less user-friendly. Example: node not included)
                    // See https://github.com/crytic/slither/issues/2207#issuecomment-1787222979
                    // As discribed in the issue, version 0.8.3 is not compatible
                    image 'ghcr.io/crytic/slither:0.10.0'
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
