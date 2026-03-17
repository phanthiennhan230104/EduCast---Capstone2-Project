import styles from "../../style/sections/TestimonialsSection.module.css";

const testimonials = [
  {
    name: "Trần Hoàng Anh",
    role: "Sinh viên Đại học Bách Khoa",
    quote:
      "Mình học được nhiều hơn từ 20 phút nghe podcast trên PodLearn hơn cả buổi học truyền thống. Cộng đồng ở đây cũng cực kỳ chất lượng.",
    avatar: "🧑",
  },
  {
    name: "Lê Phương Linh",
    role: "Product Designer tại Grab",
    quote:
      "Tính năng Study Room thay đổi hoàn toàn cách mình học. Nghe cùng bạn bè và thảo luận ngay lập tức — không đâu có được trải nghiệm này.",
    avatar: "👩",
  },
  {
    name: "Nguyễn Đức Khải",
    role: "Software Engineer",
    quote:
      "Mình dùng để học tiếng Anh chuyên ngành mỗi sáng. Sau 3 tháng, cấp trên nhận xét presentation của mình chuyên nghiệp hơn hẳn.",
    avatar: "🧑",
  },
];

export default function TestimonialsSection() {
  return (
    <section className={styles.testimonialsSection}>
      <div className={styles.headingBlock}>
        <div className={styles.sectionEyebrow}>NGƯỜI HỌC NÓI GÌ</div>

        <h2 className={styles.sectionTitle}>
          Được tin yêu bởi
          <br />
<<<<<<< HEAD
          <span>200+ người dùng.</span>
=======
          <span>120.000+ học viên.</span>
>>>>>>> d3e3f05 (Merge branch 'main' of https://github.com/phanthiennhan230104/EduCast---Capstone2-Project)
        </h2>
      </div>

      <div className={styles.testimonialsGrid}>
        {testimonials.map((item) => (
          <article key={item.name} className={styles.testimonialCard}>
            <div className={styles.stars}>★★★★★</div>

            <p className={styles.quote}>“{item.quote}”</p>

            <div className={styles.author}>
              <div className={styles.avatar}>{item.avatar}</div>
              <div>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.role}>{item.role}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}