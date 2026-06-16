import streamlit as st
import pandas as pd
import uuid
from supabase import create_client, Client

st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 0.5rem;'>기타하나</h1>", unsafe_allow_html=True)

# 로고 이미지를 중앙 정렬하여 배치 (width로 크기 조절 가능)
col_img1, col_img2, col_img3 = st.columns([1, 2, 1])
with col_img2:
    st.image("guitLogo.png", use_container_width=True) # 또는 웹상의 이미지 URL 입력

st.markdown('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">', unsafe_allow_html=True)

button_html = """
<div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 2rem;">
    <a href="http://www.youtube.com/@guitarhanapostech" target="_blank" style="color: #FF0000; font-size: 2.5rem; text-decoration: none;">
        <i class="fa-brands fa-youtube"></i>
    </a>
    <a href="https://www.instagram.com/postech_guitarhana" target="_blank" style="color: #E1306C; font-size: 2.5rem; text-decoration: none;">
        <i class="fa-brands fa-instagram"></i>
    </a>
</div>
"""
st.markdown(button_html, unsafe_allow_html=True)

###

# Supabase 클라이언트 초기화 (service_role 키 사용 중)
url: str = st.secrets["supabase"]["url"]
key: str = st.secrets["supabase"]["key"]
supabase: Client = create_client(url, key)

# 세션 상태 초기화
if 'current_view' not in st.session_state:
    st.session_state['current_view'] = '메인'
if 'admin_authenticated' not in st.session_state:
    st.session_state['admin_authenticated'] = False
if 'setlist_sessions' not in st.session_state:
    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]

# s_col1, s_col2, s_col3, s_col4 = st.columns([1.5, 1, 1, 1.5])

# 2. 내비게이션 버튼 영역
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

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("- **3월 15일:** 신입생 환영회 및 OT")
    st.write("- **5월 20일:** 1학기 정기 공연")
    st.divider()
    
    st.subheader("🎧 셋리스트 신청")
    song_name = st.text_input("곡 제목", placeholder="예: Marigold")
    artist = st.text_input("아티스트", placeholder="예: Aimyon")
    
    session_types = ["보컬", "통기타", "일렉", "베이스", "드럼", "키보드", "퍼커션", "기타"]
    for i, session in enumerate(st.session_state['setlist_sessions']):
        c1, c2, c3 = st.columns([2, 3, 1]) 
        with c1:
            session['role'] = st.selectbox("세션 구분", session_types, index=session_types.index(session['role']) if session['role'] in session_types else 0, key=f"role_{session['id']}")
        with c2:
            session['name'] = st.text_input("희망 부원 (선택)", value=session['name'], placeholder="이름 입력", key=f"name_{session['id']}")
        with c3:
            st.write("") 
            if st.button("❌ 삭제", key=f"del_{session['id']}"):
                st.session_state['setlist_sessions'].pop(i)
                st.rerun()
                
    if st.button("➕ 세션 추가"):
        st.session_state['setlist_sessions'].append({"id": str(uuid.uuid4()), "role": "통기타", "name": ""})
        st.rerun()
        
    st.write("")
    if st.button("🚀 셋리스트 신청하기", type="primary", use_container_width=True):
        if song_name and artist and len(st.session_state['setlist_sessions']) > 0:
            try:
                clean_sessions = [{"role": s["role"], "name": s["name"]} for s in st.session_state['setlist_sessions']]
                supabase.table("setlists").insert({"song_name": song_name, "artist": artist, "sessions": clean_sessions}).execute()
                st.success("✅ 셋리스트 신청이 완료되었습니다!")
                st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]
            except Exception as e:
                st.error(f"오류가 발생했습니다: {e}")
        else:
            st.warning("곡 제목, 아티스트, 최소 1개의 세션을 입력해 주세요.")

# 📝 4. 신입부원 모집 (면접 일정 선택 추가)
elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    
    # 사전에 정의해 둔 면접 일정 리스트 (원하는 대로 수정 가능)
    available_interview_slots = [
        "9월 4일 (수) 18:00 - 18:30",
        "9월 4일 (수) 18:30 - 19:00",
        "9월 5일 (목) 18:00 - 18:30",
        "9월 5일 (목) 18:30 - 19:00",
        "9월 6일 (금) 19:00 - 19:30"
    ]
    
    with st.form("recruitment_form", clear_on_submit=True):
        name = st.text_input("이름")
        student_id = st.text_input("학번")
        phone = st.text_input("연락처")
        motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        st.write("---")
        st.write("📅 **면접 가능 일정 선택 (복수 선택 가능)**")
        # 지원자가 다중 선택할 수 있는 멀티셀렉트 박스
        selected_slots = st.multiselect("가능한 시간을 모두 선택해 주세요.", available_interview_slots)
        
        submitted = st.form_submit_button("지원서 제출하기")
        
        if submitted:
            if name and student_id and phone and motive and selected_slots:
                try:
                    # 1. 지원자 기본 정보 저장
                    response = supabase.table("applicants").insert({
                        "name": name, "student_id": student_id, "phone": phone, "motive": motive
                    }).execute()
                    
                    # 방금 부여된 지원자의 고유 ID(접수번호) 가져오기
                    new_applicant_id = response.data[0]['id']
                    
                    # 2. 선택한 면접 일정들을 interview_slots 테이블에 개별 저장
                    slots_data = [{"applicant_id": new_applicant_id, "interview_time": slot} for slot in selected_slots]
                    supabase.table("interview_slots").insert(slots_data).execute()
                    
                    st.success(f"🎉 {name}님의 지원서가 성공적으로 접수되었습니다!")
                except Exception as e:
                    st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
            else:
                st.warning("⚠️ 모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.")

# 👑 5. 운영진 전용 (면접 일정 연동 확인)
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
        st.success("인증되었습니다. 접수된 지원서 목록을 불러옵니다.")
        try:
            # JOIN 쿼리: applicants 테이블을 가져오면서 연결된 interview_slots 데이터도 함께 묶어서 가져옴
            response = supabase.table("applicants").select("*, interview_slots(interview_time)").order("created_at", desc=True).execute()
            data = response.data
            
            if data:
                # 데이터를 표에 맞게 가공
                for row in data:
                    # interview_slots 리스트 안에 있는 시간들을 쉼표로 연결해서 보기 좋게 합침
                    slots = row.get('interview_slots', [])
                    row['면접 가능 시간'] = ", ".join([s['interview_time'] for s in slots]) if slots else "선택 안함"
                    del row['interview_slots'] # 원본 리스트는 삭제
                
                df = pd.DataFrame(data)
                df = df.rename(columns={"id": "접수번호", "name": "이름", "student_id": "학번", "phone": "연락처", "motive": "지원 사유", "created_at": "접수 일시"})
                df['접수 일시'] = pd.to_datetime(df['접수 일시']).dt.strftime('%Y-%m-%d %H:%M')
                
                # 운영진이 보기 편하게 열 순서 재배치
                df = df[['접수번호', '이름', '학번', '연락처', '면접 가능 시간', '지원 사유', '접수 일시']]
                
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
