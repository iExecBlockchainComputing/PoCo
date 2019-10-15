node('master') {
	stage('Choose Label') {
		LABEL = 'jenkins-agent-machine-1'
	}
}

pipeline {

	environment {
		registry = 'nexus.iex.ec'
		dockerImage1sec = ''
		dockerImage20sec = ''
		buildWhenTagContains = 'lv'
		buildWhenSidechain = 'sidechain'
	}

	agent {
		node {
			label "${LABEL}"
		}
	}

	stages {

		stage('Truffle tests') {
			agent {
				docker {
					image 'node:11'
					label "${LABEL}"
				}
			}
			steps{
				sh "echo 'Starting truffle tests'"
				sh "npm install"
				sh "./autotest.sh"
				archiveArtifacts artifacts: 'logs/**'
			}
		}

		stage('Log tag') {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				sh "echo ${BRANCH_NAME}"
				sh "echo ${TAG_NAME}"
			}
		}

		stage('Build poco-chain 1sec') {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					dockerImage1sec = docker.build (registry + "/poco-chain:${TAG_NAME}")
				}
			}
		}

		stage('Push poco-chain 1sec') {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, 'nexus' ) {
						dockerImage1sec.push()
					}
				}
			}
		}

		stage('Build poco-chain 20sec') {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					dockerImage20sec = docker.build (registry + "/poco-chain:${TAG_NAME}-20sec", "--build-arg BLOCK_CREATION_TIME=20 .")
				}
			}
		}

		stage('Push poco-chain 20sec') {
			when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
			steps{
				script {
					docker.withRegistry( "https://"+registry, 'nexus' ) {
						dockerImage20sec.push()
					}
				}
			}
		}

		stage('Build native poco-chain (5sec)') {
			when {
				expression { env.TAG_NAME != null &&
							 env.TAG_NAME.toString().contains(buildWhenTagContains) &&
							 env.BRANCH_NAME.toString().contains(buildWhenSidechain) } 
			}

			steps {
				script {
					dockerImageNative = docker.build (registry + "/poco-chain:${TAG_NAME}-native", "--build-arg BLOCK_CREATION_TIME=5 .")
				}
			}
		}

		stage('Push native poco-chain (5sec)') {
			when {
				expression { env.TAG_NAME != null &&
							 env.TAG_NAME.toString().contains(buildWhenTagContains) &&
							 env.BRANCH_NAME.toString().contains(buildWhenSidechain) } 
			}

			steps {
				script {
					docker.withRegistry( "https://"+registry, 'nexus' ) {
						dockerImageNative.push()
					}
				}
			}
		}
	}
}
