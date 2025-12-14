FROM python:3.13-slim

WORKDIR /usr/src/app

COPY ./pyproject.toml ./pyproject.toml
RUN pip install .

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]