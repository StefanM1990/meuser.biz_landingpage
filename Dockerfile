FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN cd /usr/share/nginx/html && for f in *.dc.html; do cp "$f" index.html; break; done
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
