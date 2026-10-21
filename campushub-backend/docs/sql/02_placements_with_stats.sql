-- Purpose: Placement officer dashboard — show each active placement
--          with application counts and average applicant GPA.

SELECT
    p.id                            AS placement_id,
    p.title                         AS placement_title,
    p.company,
    p.deadline,
    p.slots_available,
    u_officer.first_name || ' ' || u_officer.last_name AS posted_by,
    COUNT(a.id)                     AS total_applications,
    ROUND(AVG(u_student.gpa), 2)    AS avg_applicant_gpa
FROM placements_placement p
    LEFT JOIN placements_application a  ON a.placement_id = p.id
    LEFT JOIN accounts_user u_student   ON u_student.id = a.student_id
    LEFT JOIN accounts_user u_officer   ON u_officer.id = p.posted_by_id
WHERE p.is_active = TRUE
GROUP BY
    p.id, p.title, p.company, p.deadline, p.slots_available,
    u_officer.first_name, u_officer.last_name
ORDER BY total_applications DESC, p.deadline ASC;
