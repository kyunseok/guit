import streamlit as st
import pandas as pd
from supabase import create_client, Client

# 페이지 기본 설정
st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

# Supabase 클라이언트 초기화
url: str = st.secrets["supabase"]["url"]
key: str = st.secrets["supabase"]["key"]
supabase: Client = create_client(url, key)

# 세션 상태 초기화
if 'current_view' not in st.session_state:
    st.session_state['current_view'] = '메인'
if 'admin_authenticated' not in st.session_state:
    st.session_state['admin_authenticated'] = False

# 1. 헤더 영역
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 2rem;'>기타하나</h1>", unsafe_allow_html=True)

# 2. 내비게이션 버튼 영역 (관리자 버튼 추가)
col1, col2, col3, col4 = st.columns(4)
with col1:
    if st.button("동아리 정보", use_container_width=True): st.session_state['current_view'] = '동아리 정보'
with col2:
    if st.button("동아리 일정", use_container_width=True): st.session_state['current_view'] = '동아리 일정'
with col3:
    if st.button("신입부원 모집", use_container_width=True): st.session_state['current_view'] = '신입부원 모집'
with col4:
    if st.button("👑 운영진 전용", use_container_width=True): st.session_state['current_view'] = '운영진 전용'

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 정보':
    st.subheader("🎸 동아리 정보")
    st.write("기타하나의 소개 및 활동 내역이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("이번 학기 정기 모임 및 공연 일정이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    
    with st.form("recruitment_form", clear_on_submit=True):
        name = st.text_input("이름")
        student_id = st.text_input("학번")
        phone = st.text_input("연락처")
        motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        submitted = st.form_submit_button("지원서 제출하기")
        
        if submitted:
            if name and student_id and phone and motive:
                try:
                    response = supabase.table("applicants").insert({
                        "name": name,
                        "student_id": student_id,
                        "phone": phone,
                        "motive": motive
                    }).execute()
                    st.success(f"🎉 {name}님의 지원서가 성공적으로 접수되었습니다!")
                except Exception as e:
                    st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
            else:
                st.warning("⚠️ 모든 필드를 작성해 주세요.")

# 👑 4. 새로운 관리자 페이지 영역
elif st.session_state['current_view'] == '운영진 전용':
    st.subheader("🔒 운영진 전용 대시보드")
    
    # 비밀번호 인증이 안 된 상태라면 입력창 띄우기
    if not st.session_state['admin_authenticated']:
        st.info("관리자 비밀번호를 입력해 주세요.")
        # type="password"를 주면 입력 시 글자가 가려집니다 (***)
        pwd_input = st.text_input("비밀번호", type="password") 
        
        if st.button("확인"):
            if pwd_input == st.secrets["admin"]["password"]:
                st.session_state['admin_authenticated'] = True
                st.rerun() # 인증 성공 시 화면 새로고침
            else:
                st.error("비밀번호가 틀렸습니다.")
                
    # 인증이 완료된 상태라면 데이터베이스의 지원서 목록 보여주기
    else:
        st.success("인증되었습니다. 접수된 지원서 목록을 불러옵니다.")
        
        try:
            # DB에서 applicants 테이블의 모든 데이터(*)를 최신순으로 가져오기
            response = supabase.table("applicants").select("*").order("created_at", desc=True).execute()
            data = response.data
            
            if data:
                # 데이터를 판다스(Pandas) 데이터프레임으로 변환하여 예쁘게 출력
                df = pd.DataFrame(data)
                
                # 불필요한 열 숨기기 및 열 이름 한글화 (선택사항)
                df = df.rename(columns={
                    "id": "접수번호",
                    "name": "이름",
                    "student_id": "학번",
                    "phone": "연락처",
                    "motive": "지원 사유",
                    "created_at": "접수 일시"
                })
                
                # 시간 포맷 깔끔하게 정리 (UTC -> 보기 편한 형태로)
                df['접수 일시'] = pd.to_datetime(df['접수 일시']).dt.strftime('%Y-%m-%d %H:%M')
                
                # 스트림릿의 데이터프레임 UI를 통해 출력
                st.dataframe(df, use_container_width=True, hide_index=True)
                
            else:
                st.info("아직 접수된 지원서가 없습니다.")
                
        except Exception as e:
            st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")
            
        # 로그아웃 버튼
        if st.button("로그아웃"):
            st.session_state['admin_authenticated'] = False
            st.rerun()

else:
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
