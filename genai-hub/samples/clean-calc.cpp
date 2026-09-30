#include <iostream>
#include <memory>
#include <vector>

// 1. Interface Segregation & Single Responsibility: Operation abstraction
class IArithmeticOperation {
public:
    virtual ~IArithmeticOperation() = default;
    virtual double execute(double operandA, double operandB) const = 0;
};

// 2. Open/Closed Principle: New operations extend without modifying existing classes
class AdditionOperation : public IArithmeticOperation {
public:
    double execute(double operandA, double operandB) const override {
        return operandA + operandB;
    }
};

class DivisionOperation : public IArithmeticOperation {
public:
    double execute(double operandA, double operandB) const override {
        if (operandB == 0.0) {
            throw std::invalid_argument("Division by zero is undefined.");
        }
        return operandA / operandB;
    }
};

// 3. Dependency Inversion: Calculator depends on abstract operation, not concrete types
class CalculatorService {
public:
    double calculate(const IArithmeticOperation& operation, double operandA, double operandB) const {
        return operation.execute(operandA, operandB);
    }
};

int main() {
    CalculatorService calculator;
    AdditionOperation adder;

    double result = calculator.calculate(adder, 15.5, 24.5);
    std::cout << "Sum: " << result << std::endl;

    return 0;
}
