#!/usr/bin/python

import math
import numpy as np
import matplotlib.pyplot as plt

f  = .5
e  = math.exp(1)
# Cr = lambda k: (1-f) if k == 0 else (1-1/((1-f)*k*e))
# Cr = lambda k: (1-f) if k == 0 else (1-f/k)
Cr = lambda k: 1-f/(k+1)

if __name__ == "__main__":

  size = 1000
  x = np.arange(size)
  y = np.vectorize(Cr)(x)

  print(y)
  plt.plot(y)
  plt.show()
