#include <iostream>

int main() {
    int* ptr = nullptr;
    // Dereferencing null pointer causes Segmentation Fault (SIGSEGV)
    *ptr = 42; 
    std::cout << *ptr << std::endl;
    return 0;
}
