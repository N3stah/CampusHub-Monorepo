-- Purpose: For each student, list their enrolled courses and how many
--          resources each course has. Used on the student dashboard.

SELECT
    u.id                                AS student_id,
    u.first_name || ' ' || u.last_name  AS student_name,
    u.email,
    d.name                              AS department_name,
    c.id                                AS course_id,
    c.code                              AS course_code,
    c.title                             AS course_title,
    COUNT(r.id)                         AS resource_count
FROM academics_enrollment e
    INNER JOIN accounts_user      u ON u.id = e.student_id
    INNER JOIN academics_course   c ON c.id = e.course_id
    LEFT  JOIN academics_department d ON d.id = c.department_id
    LEFT  JOIN resources_resource   r ON r.course_id = c.id
WHERE u.role = 'student'
  AND u.is_active = TRUE
GROUP BY
    u.id, u.first_name, u.last_name, u.email,
    d.name,
    c.id, c.code, c.title
ORDER BY u.last_name, c.code;
