FROM openjdk:17-slim

# Set working directory
WORKDIR /app

# Create a non-root user for executing code safely
RUN useradd -m sandboxuser

# Command to run (will be overridden by worker)
CMD ["bash"]
