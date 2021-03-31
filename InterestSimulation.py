import matplotlib.pyplot as plt
import numpy as np


multiplier = 3 * 10**12
offsett = 2 * 10**44

x = np.linspace(-100,100,600)
scaler = 10**18; 
x = x*scaler
y = multiplier*(x**3)/scaler ;

y = (y / 2102400) + offsett

x = x / scaler

y = y / 10**44

plt.plot(x,y)
plt.grid()
plt.show()