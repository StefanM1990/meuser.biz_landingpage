FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN cd /usr/share/nginx/html && for f in *.dc.html; do cp "$f" index.html; break; done && rm -rf deploy
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
