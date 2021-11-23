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

		stage("Build poco-chain native (openethereum)") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					nativeOpenethereumDockerImage = docker.build (registry + "/poco-chain:native-${TAG_NAME}", "-f testchains/Dockerfile_native_openethereum_1sec --no-cache .")
				}
			}
		}

		stage("Push poco-chain native (openethereum)") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, "nexus" ) {
						nativeOpenethereumDockerImage.push()
					}
				}
			}
		}

		stage("Build poco-chain token (openethereum)") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					tokenOpenethereumDockerImage = docker.build (registry + "/poco-chain:token-${TAG_NAME}", "-f testchains/Dockerfile_token_openethereum_1sec --no-cache .")
				}
			}
		}

		stage("Push poco-chain token (openethereum)") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, "nexus" ) {
						tokenOpenethereumDockerImage.push()
					}
				}
			}
		}

		stage("Buidl & Push openethereum poco-chain (native & 5s)") {
			when {
				expression {
					env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains)
				}
			}
			steps {
				script {
					native5secOpenethereumDockerImage = docker.build(
						registry + "/poco-chain:native-${TAG_NAME}",
						"--file testchains/openethereum.dockerfile" +
						"--build-arg CHAIN_TYPE=native " +
						"--build-arg CHAIN_CONFIG_FOLDER_NAME=5sec " +
						"--build-arg MIGRATION_FILENAME=migrate.sh " +
						"--no-cache .")
				}
				script {
					docker.withRegistry("https://" + registry, "nexus") {
						native5secOpenethereumDockerImage.push()
					}
				}
			}
		}
	}
}
