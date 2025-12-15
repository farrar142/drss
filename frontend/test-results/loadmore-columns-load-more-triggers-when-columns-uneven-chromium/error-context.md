# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "로그인" [level=1] [ref=e4]
    - generic [ref=e5]:
      - generic [ref=e6]:
        - text: 사용자명
        - textbox "사용자명" [ref=e7]:
          - /placeholder: 사용자명을 입력하세요
      - generic [ref=e8]:
        - text: 비밀번호
        - textbox "비밀번호" [ref=e9]:
          - /placeholder: 비밀번호를 입력하세요
      - button "로그인" [ref=e10]
    - link "계정이 없으신가요? 회원가입" [ref=e12] [cursor=pointer]:
      - /url: /auth/signup
  - status [ref=e13]:
    - generic [ref=e14]:
      - img [ref=e16]
      - generic [ref=e18]:
        - text: Static route
        - button "Hide static indicator" [ref=e19] [cursor=pointer]:
          - img [ref=e20]
  - alert [ref=e23]
```