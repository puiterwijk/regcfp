#!/usr/bin/env python

"""
Setup script
"""

from setuptools import setup


setup(
    name='regcfp',
    description='A registration and calls for paper management',
    version='0.0.1d',
    author='RegCFP Contributors',
    author_email='patrick@puiterwijk.org',
    maintainer='RegCFP Contributors',
    maintainer_email='patrick@puiterwijk.org',
    license='MIT',
    url='https://github.com/puiterwijk/regcfp/',
    packages=['regcfp'],
    include_package_data=True,
    install_requires=[
        'Flask',
        'Flask-Sqlalchemy',
        'Flask-Migrate',
        'Flask-oidc',
    ],
    entry_points="""
    """,
    classifiers=[
        'License :: OSI Approved :: MIT License',
        'Operating System :: POSIX :: Linux',
        'Programming Language :: Python :: 2.7',
        'Topic :: Internet :: WWW/HTTP :: WSGI :: Application',
    ]
)
