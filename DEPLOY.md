# Production Deployment Guide

## 배포용 Docker Compose 사용법

### 1. 환경 변수 설정

```bash
# .env.production.example을 복사하여 실제 환경 변수 파일 생성
cp .env.production.example .env.production

# 필요한 환경 변수들을 수정
nano .env.production
```

### 2. 프로덕션 빌드 및 실행

```bash
# 모든 서비스 빌드 및 실행
docker compose -f prod.compose.yml up -d --build

# 특정 서비스만 빌드
docker compose -f prod.compose.yml build django
docker compose -f prod.compose.yml build node

# 로그 확인
docker compose -f prod.compose.yml logs -f

# 서비스별 로그 확인
docker compose -f prod.compose.yml logs -f django
docker compose -f prod.compose.yml logs -f node
```

### 3. 데이터베이스 마이그레이션

```bash
# Django 마이그레이션 실행
docker compose -f prod.compose.yml exec django python manage.py migrate
```

### 4. 서비스 관리

```bash
# 서비스 상태 확인
docker compose -f prod.compose.yml ps

# 서비스 재시작
docker compose -f prod.compose.yml restart django

# 서비스 중지
docker compose -f prod.compose.yml down

# 볼륨 포함 완전 삭제 (주의: 데이터 손실)
docker compose -f prod.compose.yml down -v
```

### 5. SSL 인증서 설정 (Let's Encrypt)

```bash
# certbot 사용하여 인증서 발급
certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 인증서를 nginx/certs 디렉토리에 복사
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./nginx/certs/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./nginx/certs/
```

### 6. Nginx 없이 실행 (개발/테스트용)

```bash
# nginx 서비스 제외하고 실행
docker compose -f prod.compose.yml up -d --scale nginx=0
```

---

## 파일 구조

```
drss/
├── prod.compose.yml          # 프로덕션 Docker Compose
├── .env.production.example   # 환경 변수 예제
├── backend/
│   ├── prod.Dockerfile       # 백엔드 프로덕션 Dockerfile
│   └── ...
├── frontend/
│   ├── prod.Dockerfile       # 프론트엔드 프로덕션 Dockerfile
│   └── ...
└── nginx/
    ├── nginx.conf            # Nginx 메인 설정
    ├── conf.d/               # 추가 설정
    └── certs/                # SSL 인증서
```

---

## 최적화 포인트

### Backend (Django)
- Multi-stage 빌드로 이미지 크기 최소화
- Gunicorn + Uvicorn workers로 비동기 처리
- 정적 파일 사전 수집 (collectstatic)
- Non-root 사용자로 보안 강화

### Frontend (Next.js)
- Standalone 출력 모드로 최소 번들 생성
- Multi-stage 빌드로 node_modules 제외
- Non-root 사용자로 보안 강화

### Nginx
- Gzip 압축 활성화
- Rate limiting으로 DDoS 방어
- 정적 파일 캐싱
- HTTP/2 지원 (SSL 시)

### Resource Limits
- 각 서비스별 CPU/메모리 제한 설정
- OOM 방지 및 리소스 격리
