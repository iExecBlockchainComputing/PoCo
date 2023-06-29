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
    }   finally {
        archiveArtifacts artifacts: 'coverage/**'
    }
    try {
        sh './test.sh'
    } finally {
        archiveArtifacts artifacts: 'logs/**'
    }
}

def runEachTestWithDedicatedLogFile() {
    try {
        sh './test.sh'
    } finally {
        archiveArtifacts artifacts: 'logs/**'
    }
}

//TODO: Remove
		/*
		stage("Log tag") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				sh "echo ${BRANCH_NAME}"
				sh "echo ${TAG_NAME}"
			}
		}

		stage("Native 5s image ") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					nethermindNative5secImage = docker.build(
						registry + "/poco-chain:native-${TAG_NAME}-5s",
						"--file testchains/nethermind.dockerfile" \
						+ " --build-arg \"MNEMONIC=actual surround disorder swim upgrade devote digital misery truly verb slide final\"" \
						+ " --build-arg CHAIN_TYPE=native" \
						+ " --build-arg CHAIN_BLOCK_TIME=5" \
						+ " --build-arg CHAIN_FORCE_SEALING=true" \
						+ " --no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						nethermindNative5secImage.push()
					}
				}
			}
		}

		stage("Token 5s image") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					nethermindNative5secImage = docker.build(
						registry + "/poco-chain:token-${TAG_NAME}-5s",
						"--file testchains/nethermind.dockerfile" \
						+ " --build-arg \"MNEMONIC=actual surround disorder swim upgrade devote digital misery truly verb slide final\"" \
						+ " --build-arg CHAIN_TYPE=token" \
						+ " --build-arg CHAIN_BLOCK_TIME=5" \
						+ " --build-arg CHAIN_FORCE_SEALING=true" \
						+ " --no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						nethermindNative5secImage.push()
					}
				}
			}
		}
	}
}
        */
