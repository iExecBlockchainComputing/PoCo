node("master") {
	stage("Choose Label") {
		LABEL = "jenkins-agent-machine-1"
	}
}

pipeline {

	environment {
		registry = "nexus.iex.ec"
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

		stage("Truffle tests - Public") {
			agent {
				docker {
					image "node:14"
					label "${LABEL}"
				}
			}
			steps {
				script {
					try {
						sh "npm install --no-progress"
						sh "npm run autotest fast"
					} finally {
						archiveArtifacts artifacts: "logs/**"
					}
				}
			}
		}

		stage("Truffle tests - KYC") {
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
						sh "npm install --no-progress"
						sh "npm run autotest fast"
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
						sh "npm install --no-progress"
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
						sh "npm install --no-progress"
						sh "npm run coverage"
					} finally {
						archiveArtifacts artifacts: "coverage/**"
					}
				}
			}
		}

		*/

		stage("Log tag") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				sh "echo ${BRANCH_NAME}"
				sh "echo ${TAG_NAME}"
			}
		}

		stage("Docker - openethereum + native + 1s") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					openethereumNative1secImage = docker.build(
						registry + "/poco-chain:native-${TAG_NAME}",
						"--file testchains/openethereum.dockerfile" \
						+ " --build-arg CHAIN_TYPE=native" \
						+ " --build-arg CHAIN_BLOCK_TIME=1" \
						+ " --build-arg CHAIN_FORCE_SEALING=true" \
						+ " --no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						openethereumNative1secImage.push()
					}
				}
			}
		}

		stage("Docker - openethereum + token + 1s") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					openethereumToken1secImage = docker.build(
						registry + "/poco-chain:token-${TAG_NAME}",
						"--file testchains/openethereum.dockerfile" \
						+ " --build-arg CHAIN_TYPE=token" \
						+ " --build-arg CHAIN_BLOCK_TIME=1" \
						+ " --build-arg CHAIN_FORCE_SEALING=true" \
						+ " --no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						openethereumToken1secImage.push()
					}
				}
			}
		}

		stage("Docker - openethereum + native + 5s") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					openethereumNative5secImage = docker.build(
						registry + "/poco-chain:native-${TAG_NAME}",
						"--file testchains/openethereum.dockerfile" \
						+ " --build-arg CHAIN_TYPE=native" \
						+ " --build-arg CHAIN_BLOCK_TIME=5" \
						+ " --build-arg CHAIN_FORCE_SEALING=true" \
						+ " --no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						openethereumNative5secImage.push()
					}
				}
			}
		}
	}
}
