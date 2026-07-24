FROM rust:1.80-slim-bookworm AS builder

# Add target for WASM compilation
RUN rustup target add wasm32-unknown-unknown

WORKDIR /app

# Copy crate files
COPY Cargo.toml ./
COPY src ./src

# Build backend executable
RUN cargo build --release

# Final runtime image
FROM debian:bookworm-slim

# Install runtime dependencies and rust toolchain for compilation endpoint
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.80.0
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown

WORKDIR /app

COPY --from=builder /app/target/release/lumens-block-backend /usr/local/bin/lumens-block-backend

EXPOSE 8080

ENV PORT=8080

CMD ["lumens-block-backend"]
