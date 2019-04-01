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
        buildWhenTagContains = 'lv-'
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
			        image 'node:7.4'
			        label "${LABEL}"
			    }
			}
			steps{
				sh "echo 'Starting truffle tests'"
				sh "npm install"
				sh "./autotest.sh"
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

        stage('Deploy on Kovan') {
        	when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
            agent {
                docker { 
                	image 'node:7.4'
                	label "${LABEL}"
                }
            }
            steps {
	            withCredentials([string(credentialsId: 'kovan-deployer-mnemonic', variable: 'DEPLOYER_MNEMONIC')]) {
				    sh "sed -i '/ethereumjs-util/d' package.json"
					sh "npm install"
					sh "./node_modules/.bin/truffle migrate --network kovan"
					sh "mkdir ./build/contracts-min"
      				sh "for f in \$(ls ./build/contracts); do cat ./build/contracts/\$f | ./node_modules/.bin/jqn 'pick([\"abi\",\"networks\"])' --color=false -j >> ./build/contracts-min/\$f; done"
				}
            }
        }

	   	stage('Push npm') {
		    when { expression { env.TAG_NAME != null && env.TAG_NAME.toString().contains(buildWhenTagContains) } }
		    agent {
		        docker {
		            image 'node:7.4'
		            label "${LABEL}"
		        }
		    }
		    steps { 
		        withNPM(npmrcConfig:'iexecteam-npmrc') {
		            echo "Performing npm build..."
		            sh 'npm whoami'
		        }
		    }
		}

    }
    
}
