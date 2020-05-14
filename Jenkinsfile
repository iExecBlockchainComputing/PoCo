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

		stage("Truffle tests") {
			agent {
				docker {
					image "node:11"
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

		stage("Solidity coverage") {
			agent {
				docker {
					image "node:11"
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

		stage("Log tag") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				sh "echo ${BRANCH_NAME}"
				sh "echo ${TAG_NAME}"
			}
		}

		stage("Build poco-chain token") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					tokenDockerImage = docker.build (registry + "/poco-chain:token-${TAG_NAME}", "-f testchains/Dockerfile_token_parity_1sec .")
				}
			}
		}

		stage("Push poco-chain token") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, "nexus" ) {
						tokenDockerImage.push()
					}
				}
			}
		}

		stage("Build poco-chain native") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					nativeDockerImage = docker.build (registry + "/poco-chain:native-${TAG_NAME}", "-f testchains/Dockerfile_native_parity_1sec .")
				}
			}
		}

		stage("Push poco-chain native") {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, "nexus" ) {
						nativeDockerImage.push()
					}
				}
			}
		}
	}
}
