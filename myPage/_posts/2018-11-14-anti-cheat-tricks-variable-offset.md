---
layout: post
title: Anti cheat tricks - Variable offset
keywords:
  - cpp
  - reverse engineering
  - code
---
```c++
#include <iostream>

template<typename T>
class OffsetVariable {
private:
  T value;
  int offset;

public:
  explicit OffsetVariable(T initial) {
    offset = 1337; // Generate a random number here
    value = initial + offset;
  }

  T get() {
    return value - offset;
  }

  void set(T v) {
    value = v + offset;
  }
};

int main() {
  OffsetVariable<int> health(100);
  OffsetVariable<float> mana(100);

  std::cout << "Player health: " << health.get() << std::endl;
  std::cout << "Player mana: " << mana.get() << std::endl;

  health.set(50);
  mana.set(25);
  
  std::cout << "Player health: " << health.get() << std::endl;
  std::cout << "Player mana: " << mana.get() << std::endl;
  return 0;
}
```
