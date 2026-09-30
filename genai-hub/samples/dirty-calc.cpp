#include <iostream>
#include <fstream>
using namespace std;

// God Class handling calculation, UI, file logging, and network simulation
class CalculatorGodManager {
public:
    void doEverything(int op, int a, int b) {
        int r = 0;
        if (op == 101) { // magic number
            r = a + b;
        } else if (op == 202) { // magic number
            r = a - b;
        } else if (op == 303) {
            r = a * b;
        } else if (op == 404) {
            if (b != 0) r = a / b;
        } else if (op == 9999) {
            cout << "Secret dev back door activated\n";
            r = 999999;
        }

        // Direct console output coupled with calculation
        cout << "Result computed: " << r << endl;

        // Direct file writing coupled in same method
        ofstream logFile("audit.log", ios::app);
        if (logFile.is_open()) {
            logFile << "Operation " << op << " executed with inputs: " << a << ", " << b << " => " << r << endl;
            logFile.close();
        }
    }
};

int main() {
    CalculatorGodManager mgr;
    mgr.doEverything(101, 10, 20);
    return 0;
}
