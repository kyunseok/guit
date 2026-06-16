import streamlit as st
import pandas as pd
import uuid
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
# 셋리스트 가변 세션을 위한 상태 초기화
if 'setlist_sessions' not in st.session_state:
    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]

# 1. 헤더 및 소셜 링크 영역
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 0.5rem;'>기타하나</h1>", unsafe_allow_html=True)

# 소셜 버튼을 가운데 예쁘게 모으기 위한 레이아웃
s_col1, s_col2, s_col3, s_col4 = st.columns([1.5, 1, 1, 1.5])
with s_col2:
    st.link_button("📺 YouTube", "http://www.youtube.com/@guitarhanapostech", use_container_width=True)
with s_col3:
    st.link_button("📸 Instagram", "https://www.instagram.com/postech_guitarhana?igsh=ZGdzd3BxcTd4MWxw", use_container_width=True)

st.markdown("<br>", unsafe_allow_html=True)

# 2. 내비게이션 버튼 영역 ('동아리 정보' -> '동아리 소개'로 변경)
col1, col2, col3, col4 = st.columns(4)
with col1:
    if st.button("동아리 소개", use_container_width=True): st.session_state['current_view'] = '동아리 소개'
with col2:
    if st.button("동아리 일정", use_container_width=True): st.session_state['current_view'] = '동아리 일정'
with col3:
    if st.button("신입부원 모집", use_container_width=True): st.session_state['current_view'] = '신입부원 모집'
with col4:
    if st.button("👑 운영진 전용", use_container_width=True): st.session_state['current_view'] = '운영진 전용'

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 소개':
    st.subheader("🎸 동아리 소개")
    st.write("기타하나의 소개 및 활동 내역이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    with st.form("recruitment_form", clear_on_submit=True):
        name = st.text_input("이름")
        student_id = st.text_input("학번")
        phone = st.text_input("연락처")
        motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        if st.form_submit_button("지원서 제출하기"):
            if name and student_id and phone and motive:
                try:
                    supabase.table("applicants").insert({
                        "name": name, "student_id": student_id, "phone": phone, "motive": motive
                    }).execute()
                    st.success(f"🎉 {name}님의 지원서가 성공적으로 접수되었습니다!")
                except Exception as e:
                    st.error(f"오류가 발생했습니다: {e}")
            else:
                st.warning("⚠️ 모든 필드를 작성해 주세요.")

# 🎸 4. 동아리 일정 및 셋리스트 신청 기능
elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("- **3월 15일:** 신입생 환영회 및 OT")
    st.write("- **4월 10일:** 봄맞이 정기 버스킹")
    st.write("- **5월 20일:** 1학기 정기 공연")
    
    st.divider()
    
    st.subheader("🎧 셋리스트 신청")
    st.write("공연하고 싶은 곡과 필요한 세션을 구성해 보세요.")
    
    song_name = st.text_input("곡 제목", placeholder="예: Marigold")
    artist = st.text_input("아티스트", placeholder="예: Aimyon")
    
    st.write("👇 **필요 세션 구성**")
    
    # 동적 세션 입력창 렌더링
    session_types = ["보컬", "통기타", "일렉", "베이스", "드럼", "키보드", "퍼커션", "기타"]
    
    for i, session in enumerate(st.session_state['setlist_sessions']):
        # x 버튼을 포함한 3단 컬럼
        c1, c2, c3 = st.columns([2, 3, 1]) 
        
        with c1:
            # 고유한 key 부여가 매우 중요합니다.
            session['role'] = st.selectbox("세션 구분", session_types, index=session_types.index(session['role']) if session['role'] in session_types else 0, key=f"role_{session['id']}")
        with c2:
            session['name'] = st.text_input("희망 부원 (선택)", value=session['name'], placeholder="이름 입력 (미정일 경우 비워둠)", key=f"name_{session['id']}")
        with c3:
            st.write("") # 버튼 높이 맞추기용
            if st.button("❌ 삭제", key=f"del_{session['id']}"):
                st.session_state['setlist_sessions'].pop(i)
                st.rerun() # 삭제 후 즉시 화면 갱신
                
    if st.button("➕ 세션 추가"):
        st.session_state['setlist_sessions'].append({"id": str(uuid.uuid4()), "role": "통기타", "name": ""})
        st.rerun()
        
    st.write("")
    if st.button("🚀 셋리스트 신청하기", type="primary", use_container_width=True):
        if song_name and artist:
            if len(st.session_state['setlist_sessions']) > 0:
                try:
                    # DB에 저장하기 전 내부 식별용 id 제거 후 깔끔하게 저장
                    clean_sessions = [{"role": s["role"], "name": s["name"]} for s in st.session_state['setlist_sessions']]
                    
                    supabase.table("setlists").insert({
                        "song_name": song_name,
                        "artist": artist,
                        "sessions": clean_sessions
                    }).execute()
                    
                    st.success("✅ 셋리스트 신청이 완료되었습니다!")
                    # 폼 초기화
                    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]
                except Exception as e:
                    st.error(f"오류가 발생했습니다: {e}")
            else:
                st.warning("최소 1개 이상의 세션을 추가해 주세요.")
        else:
            st.warning("곡 제목과 아티스트를 모두 입력해 주세요.")

# 👑 5. 관리자 페이지 (기존과 동일)
elif st.session_state['current_view'] == '운영진 전용':
    st.subheader("🔒 운영진 전용 대시보드")
    if not st.session_state['admin_authenticated']:
        st.info("관리자 비밀번호를 입력해 주세요.")
        pwd_input = st.text_input("비밀번호", type="password") 
        if st.button("확인"):
            if pwd_input == st.secrets["admin"]["password"]:
                st.session_state['admin_authenticated'] = True
                st.rerun()
            else:
                st.error("비밀번호가 틀렸습니다.")
    else:
        st.success("인증되었습니다.")
        try:
            response = supabase.table("applicants").select("*").order("created_at", desc=True).execute()
            data = response.data
            if data:
                df = pd.DataFrame(data)
                df = df.rename(columns={"id": "접수번호", "name": "이름", "student_id": "학번", "phone": "연락처", "motive": "지원 사유", "created_at": "접수 일시"})
                df['접수 일시'] = pd.to_datetime(df['접수 일시']).dt.strftime('%Y-%m-%d %H:%M')
                st.dataframe(df, use_container_width=True, hide_index=True)
            else:
                st.info("아직 접수된 지원서가 없습니다.")
        except Exception as e:
            st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")
            
        if st.button("로그아웃"):
            st.session_state['admin_authenticated'] = False
            st.rerun()
else:
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
