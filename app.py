import streamlit as st
import pandas as pd
from pathlib import Path
import random
import string

st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

# 실행 위치와 관계없이 app.py를 기준으로 파일을 찾습니다.
BASE_DIR = Path(__file__).resolve().parent
MATERIALS_DIR = BASE_DIR / "materials"
CALENDAR_DIR = BASE_DIR / "assets"
VIEWS = ("동아리 소개", "동아리 일정", "신입부원 모집")


def render_schedule():
    st.subheader("📅 동아리 일정")
    # 기존 일정 문구를 유지했습니다. 일정이 바뀌면 이 부분을 수정하세요.
    st.write("- **8월 23일 - 9월 2일:** 26년도 2학기 신입부원 모집")
    st.write("- **9월 6일 - 9월 8일:** 26년도 2학기 신입부원 면접")
    st.write("- **9월 9일:** 2학기 개강총회")
    st.write("- **9월 12일:** 2학기 엠티")

    st.divider()
    st.subheader("🗓️ 일정 달력")
    # 이 목록에서 처음 발견된 사진 하나만 표시합니다.
    calendar = next((
        CALENDAR_DIR / f"calendar.{ext}"
        for ext in ("png", "jpg", "jpeg", "webp")
        if (CALENDAR_DIR / f"calendar.{ext}").is_file()
    ), None)
    if calendar is None:
        st.info("아직 등록된 달력이 없습니다.")
    else:
        try:
            calendar_bytes = calendar.read_bytes()
            st.image(calendar_bytes, caption="기타하나 일정 달력", width="stretch")
            image_mime = {
                ".png": "image/png", ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg", ".webp": "image/webp",
            }[calendar.suffix]
            st.download_button(
                "달력 원본 다운로드", data=calendar_bytes,
                file_name=calendar.name, mime=image_mime,
                key="calendar_download",
            )
        except (OSError, ValueError):
            st.error("달력 이미지를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.")

    st.divider()
    st.subheader("📚 정모 자료")
    st.write("필요한 자료의 다운로드 버튼을 눌러 PDF를 저장하세요.")
    pdf_files = sorted(
        (p for p in MATERIALS_DIR.iterdir()
         if p.is_file() and p.suffix.lower() == ".pdf"),
        key=lambda p: p.name, reverse=True,
    ) if MATERIALS_DIR.is_dir() else []

    if not pdf_files:
        st.info("아직 등록된 정모 자료가 없습니다.")
    for pdf in pdf_files:
        try:
            pdf_bytes = pdf.read_bytes()
        except OSError:
            st.warning(f"자료를 불러올 수 없습니다: {pdf.name}")
            continue
        with st.container(border=True):
            st.text(pdf.stem.replace("_", " "))
            st.caption(f"PDF · {len(pdf_bytes) / (1024 * 1024):.2f} MB")
            st.download_button(
                "📥 PDF 다운로드", data=pdf_bytes,
                file_name=pdf.name, mime="application/pdf",
                key=f"pdf_{pdf.name}",
            )


# 이전 화면 상태가 남아 있어도 유효한 메뉴로 돌아갑니다.
if st.session_state.get("current_view") not in VIEWS:
    st.session_state["current_view"] = "동아리 소개"
if "show_greedy_result" not in st.session_state:
    st.session_state["show_greedy_result"] = False

# 일정 페이지에서만 본문을 넓혀 달력을 크게 표시합니다.
if st.session_state["current_view"] == "동아리 일정":
    st.markdown(
        "<style>.block-container {max-width: 1200px;}</style>",
        unsafe_allow_html=True,
    )

# 1. 헤더 및 소셜 링크 영역
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 0.5rem;'>기타하나</h1>", unsafe_allow_html=True)

col_img1, col_img2, col_img3 = st.columns([1, 2, 1])
with col_img2:
    st.image(str(BASE_DIR / "guitLogo.png"), width="stretch")

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

# 2. 내비게이션: 비밀번호 없이 세 메뉴를 이용합니다.
def change_view(view):
    st.session_state["current_view"] = view


for view in VIEWS:
    st.button(
        view, width="stretch",
        on_click=change_view, args=(view,),
    )

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 소개':
    st.subheader("🎸 동아리 소개")
    st.write("""기타하나는 어쿠스틱 통기타 동아리입니다. 
            주로 정기공연, 버스킹 등의 행사를 진행하고 기타 뿐만 아니라 키보드, 드럼, 일렉, 베이스 등 여러가지 악기를 다루며 자신이 하고 싶은 곡으로 공연을 꾸며나갈 수 있습니다. 
            또한 신입생들을 위해 동아리 내부에서 기타교실을 운영하기 때문에 기타에 자신이 없어도 동아리에 들어와서 배워나갈 수 있습니다.
            \n\n
            **Contact**
            회장: 경규헌(gyuheon0117@postech.ac.kr)
            웹사이트 관련 문제: 김윤석(kyunseok@postech.ac.kr)""")

elif st.session_state['current_view'] == '동아리 일정':
    render_schedule()

# 📝 4. 신입부원 모집
elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")

    # 모집 화면에서만 Supabase를 연결합니다.
    # 설정이 없어도 소개와 일정/PDF 페이지는 사용할 수 있습니다.
    try:
        from supabase import create_client
        config = st.secrets["supabase"]
        supabase = create_client(config["url"], config["key"])
    except Exception:
        st.error("모집 기능에 연결할 수 없습니다. 운영진에게 문의해 주세요.")
        st.stop()
    
    tab1, tab2 = st.tabs(["✍️ 지원서 작성", "🔍 제출 내역 확인"])
    
    with tab1:
        available_interview_slots = [
            "9월 4일 (수) 18:00 - 18:30", "9월 4일 (수) 18:30 - 19:00",
            "9월 5일 (목) 18:00 - 18:30", "9월 5일 (목) 18:30 - 19:00",
            "9월 6일 (금) 19:00 - 19:30"
        ]
        
        with st.form("recruitment_form", clear_on_submit=True):
            name = st.text_input("이름", max_chars=10)
            student_id = st.text_input("학번", max_chars=20)
            phone = st.text_input("연락처", max_chars=15)
            motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.", max_chars=1000)
            
            st.write("---")
            st.write("📅 **면접 가능 일정 선택 (복수 선택 가능)**")
            selected_slots = st.multiselect("가능한 시간을 모두 선택해 주세요.", available_interview_slots)
            
            submitted = st.form_submit_button("지원서 제출하기")
            
            if submitted:
                if name and student_id and phone and motive and selected_slots:
                    try:
                        while True:
                            new_app_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                            check_dup = supabase.table("applicants").select("id").eq("id", new_app_id).execute()
                            if not check_dup.data:
                                break 
                        
                        supabase.table("applicants").insert({
                            "id": new_app_id, "name": name, "student_id": student_id, "phone": phone, "motive": motive
                        }).execute()
                        
                        slots_data = [{"applicant_id": new_app_id, "interview_time": slot} for slot in selected_slots]
                        supabase.table("interview_slots").insert(slots_data).execute()
                        
                        st.success(f"🎉 성공적으로 접수되었습니다! 본인의 지원서 코드는 [{new_app_id}] 입니다.\n원할 경우 언제든지 지원서 코드를 이용해 본인의 지원서를 조회할 수 있습니다.")
                    except Exception as e:
                        # [변경됨] 에러 메시지에 '23505' 또는 'unique' 키워드가 포함되어 있으면 친절한 메시지로 변경
                        error_msg = str(e)
                        if '23505' in error_msg or 'unique_student_id' in error_msg:
                            st.warning("⚠️ 이미 해당 학번으로 신청한 내역이 존재합니다.")
                        else:
                            st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
                else:
                    st.warning("⚠️ 모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.")

    with tab2:
        st.write("발급받은 6자리 지원서 코드를 입력하여 제출 내역을 확인할 수 있습니다.")
        search_id = st.text_input("지원서 코드 (6자리 영문/숫자)", max_chars=6)
        
        if st.button("내 지원서 조회하기"):
            if search_id:
                try:
                    search_id = search_id.upper()
                    response = supabase.table("applicants").select("*, interview_slots(interview_time)").eq("id", search_id).execute()
                    
                    if response.data:
                        app_data = response.data[0]
                        st.success(f"✅ {app_data['name']}님의 지원서는 다음과 같습니다.")
                        
                        st.write(f"**학번:** {app_data['student_id']}")
                        st.write(f"**연락처:** {app_data['phone']}")
                        st.write(f"**지원 사유:**\n> {app_data['motive']}")
                        
                        slots = [s['interview_time'] for s in app_data.get('interview_slots', [])]
                        st.write(f"**선택한 면접 일정:** {', '.join(slots) if slots else '없음'}")
                        st.write(f"**접수 일시:** {pd.to_datetime(app_data['created_at']).strftime('%Y-%m-%d %H:%M')}")
                        
                    else:
                        st.error("❌ 일치하는 지원서 코드가 없습니다.")
                except Exception as e:
                    st.error(f"조회 중 오류가 발생했습니다: {e}")
            else:
                st.warning("지원서 코드를 입력해 주세요.")

    # 요청에 따라 전체 지원서 조회와 면접 배정을 공개합니다.
    st.divider()
    st.subheader("지원서 현황 및 면접 배정 관리")

    try:
        response = supabase.table("applicants").select("*, interview_slots(interview_time)").order("created_at", desc=True).execute()
        data = response.data

        if data:
            app_list = []
            for row in data:
                slots = [s['interview_time'] for s in row.get('interview_slots', [])]
                app_list.append({
                    "지원서코드": row['id'],
                    "이름": row['name'], 
                    "학번": row['student_id'], 
                    "연락처": row['phone'],
                    "면접 가능 시간": ", ".join(slots) if slots else "선택 안함",
                    "지원 사유": row['motive'],
                    "접수 일시": row['created_at'],
                    "slots_raw": slots,
                    "slot_count": len(slots)
                })

            st.write(f"##### 전체 지원서 목록 (총 {len(app_list)}명)")
            df_all = pd.DataFrame(app_list)

            df_display = df_all.drop(columns=['slots_raw', 'slot_count'])
            df_display['접수 일시'] = pd.to_datetime(df_display['접수 일시']).dt.strftime('%Y-%m-%d %H:%M')
            st.dataframe(df_display, width="stretch", hide_index=True)

            st.write("")

            if st.button("면접 시간 자동 배정", type="primary"):
                st.session_state['show_greedy_result'] = True

            if st.session_state['show_greedy_result']:
                st.write("##### 면접 시간 자동 배정 결과")

                sorted_apps = sorted(app_list, key=lambda x: x['slot_count'])

                assigned_times = {} 
                results = []

                for app in sorted_apps:
                    assigned_slot = "배정 실패 (수동 조율 필요)"
                    for slot in app['slots_raw']:
                        if slot not in assigned_times:
                            assigned_times[slot] = app['이름']
                            assigned_slot = slot
                            break

                    results.append({
                        "이름": app['이름'], "학번": app['학번'], "연락처": app['연락처'],
                        "배정된 시간": assigned_slot, "지원 사유": app['지원 사유']
                    })

                result_df = pd.DataFrame(results)
                st.success("면접 배정이 완료되었습니다!")
                st.dataframe(result_df, width="stretch", hide_index=True)

                csv = result_df.to_csv(index=False).encode('utf-8-sig')
                st.download_button(
                    label="배정 결과 다운로드 (CSV)",
                    data=csv,
                    file_name='면접배정결과.csv',
                    mime='text/csv',
                )
        else:
            st.info("아직 접수된 지원서가 없습니다.")
    except Exception as e:
        st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")

