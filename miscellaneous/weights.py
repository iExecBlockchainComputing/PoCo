#!/usr/bin/python

import math

def weight(credibility):
	return -math.log(1-credibility)

if __name__ == '__main__':
	l = []
	l.append(weight(credibility=0.8))
	# l.append(weight(credibility=0.9))
	# l.append(weight(credibility=0.9))
	# l.append(weight(credibility=0.99))
	# l.append(weight(credibility=0.999))
	l.append(weight(credibility=0.9999))
	l.append(weight(credibility=0.99999))

	r = sum(l)
	for v in l:
		print(v / r)