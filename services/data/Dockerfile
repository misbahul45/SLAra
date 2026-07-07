FROM golang:1.24-alpine
RUN apk add --no-cache ca-certificates git

WORKDIR /app

# Install Air untuk Hot Reload
RUN go install github.com/air-verse/air@latest

COPY go.mod go.sum ./
RUN go mod download

EXPOSE 8081

# Jalankan air (pastikan ada file .air.toml di root folder service/data, jika tidak air akan pakai default)
CMD ["air", "-c", ".air.toml"]