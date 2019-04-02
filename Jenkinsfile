node('master') {
	stage('Choose Label') {
		LABEL = 'jenkins-agent-machine-1'
	}
}

pipeline {
	environment {
		registry = 'nexus.iex.ec'
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
	}
}
