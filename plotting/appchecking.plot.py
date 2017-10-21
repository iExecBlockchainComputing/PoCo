#!/usr/bin/python

import numpy
import matplotlib.pyplot as plt


class Functions:
	def p(x,n): return 1-(1.0-x)**n
	def x(p,n): return 1.0-(1.0-p)**(1.0/n)
	def n(x,p): return numpy.log(1-p)/numpy.log(1-x)

class Samples:
	x  = numpy.logspace(numpy.log10(0.00001),numpy.log10(0.99999), 1000)
	p  = numpy.logspace(numpy.log10(0.00001),numpy.log10(0.99999), 1000)
	ns = [10,25,50,100,250,500,1000]
	ps = [1-1e-1, 1-1e-2, 1-1e-3, 1-1e-4]

def initPlot():
	plt.figure(figsize=(16,9))
	plt.axes().spines['right'].set_visible(False)
	plt.axes().spines['top'  ].set_visible(False)

def savePlot(fname=None):
	plt.legend()
	if fname == None:
		plt.show()
	else:
		plt.savefig(fname)

def multiPlot():
	#############################################################################
	#                Non-determinism detectability: p=1-(1-x)**n                #
	#############################################################################
	initPlot()
	for n in Samples.ns:
		plt.plot(Samples.x, Functions.p(x=Samples.x,n=n),  label="%d repetitions" % n)
	plt.title("Non-determinism detectability")
	plt.xlabel("Portion of erroneous results (application non-determinism)")
	plt.ylabel("Likelihood to detect the non-determinism")
	plt.xlim(1e-4, 5e-1)
	plt.ylim(0.00, 1.00)
	plt.xscale("log")
	savePlot(fname='detectability.png')
	#############################################################################
	#               Dectectable non determinism x=1-(1-p)**(1/n)                #
	#############################################################################
	initPlot()
	for n in Samples.ns:
		plt.plot(Samples.p, Functions.x(p=1-Samples.p,n=n),  label="%d repetition(s)" % n)
	plt.title("Dectectable non-determinism")
	plt.xlabel("Likelihood to fail to detect the non-determinism")
	plt.ylabel("Maximum potion of erroneous results")
	plt.xlim(1e-4, 5e-1)
	plt.ylim(1e-3, 1e0)
	plt.xscale("log")
	plt.yscale("log")
	savePlot(fname='detectable.png')
	#############################################################################
	#                           Required repetitions                            #
	#############################################################################
	initPlot()
	for p in Samples.ps:
		plt.plot(Samples.x, Functions.n(x=Samples.x,p=p), label="p=%.4f" % p)
	plt.title("Required repetitions")
	plt.xlabel("Portion of erroneous results (application non-determinism)")
	plt.ylabel("Number of repetitions required")
	plt.xlim(1e-5, 1e0)
	plt.xscale("log")
	plt.yscale("log")
	savePlot(fname='repetitions.png')
	#############################################################################



if __name__ == '__main__':
	multiPlot()
	# print("n(p=0.9999, x=0.0001):", Functions.n(p=0.9999, x=0.0001))
	# print("p(x=0.1000, n=100   ):", Functions.p(x=0.1, n=100))
