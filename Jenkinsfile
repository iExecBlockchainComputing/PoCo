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
				sh "npm run autotest"
				archiveArtifacts artifacts: 'logs/**'
			}
		}

		stage('Solidity coverage') {
			agent {
				docker {
					image 'node:11'
					label "${LABEL}"
				}
			}
			steps{
				sh "echo 'Starting coverage test'"
				sh "npm install"
				sh "npm run coverage"
				archiveArtifacts artifacts: 'coverage/**'
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
					dockerImage1sec = docker.build registry + "/poco-chain:${TAG_NAME}"
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
					dockerImage20sec = docker.build (registry + "/poco-chain:${TAG_NAME}-20sec", "-f Dockerfile_20sec .")
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
	}
}
