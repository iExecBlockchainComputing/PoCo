// TODO1 Remove useless build stages & use scripted pipeline
// TODO2 Run unit tests on token AND native? -> IexecEscrowNative.js, all others
pipeline {
    agent {
        docker {
            label 'docker'
            image 'node:18'
        }
    }

    stages {
        stage('Init') {
            steps {
                script {
                    sh 'npm ci --production=false --no-progress'
                    sh 'npm run test-storage-layout'
                    // Verify basic deployment. Might be removed at some point.
                    sh 'npm run deploy'
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

def test() {
    try {
        sh 'npm run coverage'
    } catch(Exception e) {
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
