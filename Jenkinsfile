// TODO1 Remove useless build stages & use scripted pipeline
// TODO2 Run unit tests on token AND native? -> IexecEscrowNative.js, all others

node("master") {
	stage("Choose Label") {
		LABEL = "jenkins-agent-machine-1"
	}
}

pipeline {

	environment {
		registry = "nexus.intra.iex.ec"
		tokenDockerImage = ""
		nativeDockerImage = ""
		buildWhenTagContains = "v"
	}

	agent {
		node {
			label "${LABEL}"
		}
	}

	stages {

		stage("Hardhat tests - Public") {
			agent {
				docker {
					image "node:18"
					label "${LABEL}"
				}
			}
			steps {
				script {
					try {
						sh "npm ci --production=false --no-progress"
						sh "npm run test-storage-layout"
						sh "./test.sh"
                        // Verify basic deployment. Might be removed at some point.
						sh "npm run deploy"
					} finally {
						archiveArtifacts artifacts: "logs/**"
					}
				}
			}
		}

		stage("Hardhat tests - KYC") {
			agent {
				docker {
					image "node:18"
					label "${LABEL}"
				}
			}
			environment {
				KYC = 'true'
			}
			steps {
				script {
					try {
						sh "npm ci --production=false --no-progress"
						sh "npm run test-storage-layout"
						sh "./test.sh"
					} finally {
						archiveArtifacts artifacts: "logs/**"
					}
				}
			}
		}

		/*
		Disable coverage 

		stage("Solidity coverage - Public") {
			agent {
				docker {
					image "node:14"
					label "${LABEL}"
				}
			}
			steps {
				script {
					try {
						sh "npm ci --production=false --no-progress"
						sh "npm run coverage"
					} finally {
						archiveArtifacts artifacts: "coverage/**"
					}
				}
			}
		}

		stage("Solidity coverage - KYC") {
			agent {
				docker {
					image "node:14"
					label "${LABEL}"
				}
			}
			environment {
				KYC = 'true'
			}
			steps {
				script {
					try {
						sh "npm ci --production=false --no-progress"
						sh "npm run coverage"
					} finally {
						archiveArtifacts artifacts: "coverage/**"
					}
				}
			}
		}

		*/
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
        */
	}
}
